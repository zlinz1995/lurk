// server.js
import express from "express";
import http from "http";
import { Server } from "socket.io";
import next from "next";

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();
const videoRooms = new Map();

try {
  app.prepare().then(() => {
    const expressApp = express();
    const server = http.createServer(expressApp);

    // --- SOCKET.IO SETUP ---
    const io = new Server(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    io.on("connection", (socket) => {
      console.log("✅ User connected:", socket.id);

      const leaveVideoRoom = () => {
        const roomId = socket.data?.videoRoom;
        if (!roomId) return;
        const members = videoRooms.get(roomId);
        if (members) {
          members.delete(socket.id);
          if (members.size === 0) {
            videoRooms.delete(roomId);
          } else {
            videoRooms.set(roomId, members);
          }
        }
        socket.leave(roomId);
        io.to(roomId).emit("video-peer-left", {
          peerId: socket.id,
          name: socket.data?.videoName,
        });
        socket.data.videoRoom = undefined;
        socket.data.videoName = undefined;
      };

      socket.on("chat message", (msg) => {
        io.emit("chat message", msg);
      });

      socket.on("join-video-room", ({ roomId, name } = {}) => {
        const targetRoom = roomId || "global-video-room";
        if (socket.data?.videoRoom && socket.data.videoRoom !== targetRoom) {
          leaveVideoRoom();
        }
        const members = videoRooms.get(targetRoom) || new Map();
        socket.join(targetRoom);
        socket.data.videoRoom = targetRoom;
        socket.data.videoName = name || `Guest-${socket.id.slice(-4)}`;
        const existingPeers = Array.from(members.entries()).map(([peerId, meta]) => ({
          peerId,
          name: meta?.name,
        }));
        members.set(socket.id, { name: socket.data.videoName });
        videoRooms.set(targetRoom, members);
        socket.emit("video-existing-peers", existingPeers);
        socket.to(targetRoom).emit("video-peer-joined", {
          peerId: socket.id,
          name: socket.data.videoName,
        });
      });

      socket.on("leave-video-room", ({ roomId } = {}) => {
        if (!socket.data?.videoRoom) return;
        if (roomId && roomId !== socket.data.videoRoom) return;
        leaveVideoRoom();
      });

      socket.on("video-offer", ({ to, description } = {}) => {
        if (!to || !description) return;
        io.to(to).emit("video-offer", { from: socket.id, description });
      });

      socket.on("video-answer", ({ to, description } = {}) => {
        if (!to || !description) return;
        io.to(to).emit("video-answer", { from: socket.id, description });
      });

      socket.on("video-ice-candidate", ({ to, candidate } = {}) => {
        if (!to || !candidate) return;
        io.to(to).emit("video-ice-candidate", { from: socket.id, candidate });
      });

      socket.on("video-room-message", ({ roomId, text, name, id, ts } = {}) => {
        const targetRoom = roomId || socket.data?.videoRoom;
        if (!targetRoom || !text) return;
        const payload = {
          id: id || `${socket.id}-${Date.now()}`,
          name: name || socket.data?.videoName || "Guest",
          text,
          ts: ts || Date.now(),
        };
        io.to(targetRoom).emit("video-room-message", payload);
      });

      socket.on("disconnect", () => {
        leaveVideoRoom();
        console.log("❌ User disconnected:", socket.id);
      });
    });

    // --- NEXT.JS HANDLER (REGEX FIX FOR EXPRESS v5) ---
    expressApp.all(/.*/, (req, res) => {
      try {
        return handle(req, res);
      } catch (err) {
        console.error("❌ Route handling error:", err);
        res.status(500).send("Server error");
      }
    });

    // --- PORT CONFIGURATION ---
    const PORT = process.env.PORT || 8080;
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Lurk running on port ${PORT}`);
    });
  }).catch((err) => {
    console.error("❌ Next.js prepare() failed:", err);
    process.exit(1);
  });
} catch (err) {
  console.error("❌ Fatal startup error:", err);
  process.exit(1);
}
