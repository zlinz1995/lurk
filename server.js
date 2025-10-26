// server.js
import express from "express";
import http from "http";
import { Server } from "socket.io";
import next from "next";
import multer from "multer";
import path from "path";
import fs from "fs";
import helmet from "helmet";
import morgan from "morgan";

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();
const videoRooms = new Map();

try {
  app.prepare().then(() => {
    const expressApp = express();
    const server = http.createServer(expressApp);

    // --- BASIC APP MIDDLEWARE ---
    expressApp.use(helmet());
    expressApp.use(morgan("tiny"));
    expressApp.use(express.json({ limit: "1mb" }));
    expressApp.use(express.urlencoded({ extended: true }));

    // Serve runtime uploads (not part of Next public/ build)
    const uploadsDir = path.join(process.cwd(), "uploads");
    try {
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    } catch {}
    expressApp.use("/uploads", express.static(uploadsDir, { fallthrough: true }));

    // --- IN-MEMORY STORE (ephemeral, 1 hour TTL) ---
    const THREAD_TTL_MS = 60 * 60 * 1000; // 1 hour
    let nextThreadId = 1;
    let nextReplyId = 1;
    /** @type {Array<{id:number,title:string,body?:string,image?:string,sensitive?:boolean,timestamp:string,expiry:number,views?:number,reactions?:Record<string,number>,replies?:Array<{id:number,text:string,timestamp:string}>}>} */
    let threads = [];

    // --- Multer for image uploads ---
    const storage = multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, uploadsDir),
      filename: (_req, file, cb) => {
        const ext = (path.extname(file.originalname) || "").toLowerCase();
        const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
        cb(null, name);
      },
    });
    const upload = multer({
      storage,
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
      fileFilter: (_req, file, cb) => {
        try {
          const ok = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
            String(file.mimetype || "").toLowerCase()
          );
          cb(ok ? null : new Error("INVALID_FILE"), ok);
        } catch {
          cb(null, true);
        }
      },
    });

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

    // --- THREADS API ---
    const purgeExpired = () => {
      const now = Date.now();
      const keep = [];
      const purgedIds = [];
      for (const t of threads) {
        const end = typeof t.expiry === "number" ? t.expiry : (new Date(t.timestamp).getTime() + THREAD_TTL_MS);
        if (end > now) {
          keep.push(t);
        } else {
          purgedIds.push(t.id);
          try {
            if (t.image && t.image.startsWith("/uploads/")) {
              const p = path.join(uploadsDir, t.image.replace("/uploads/", ""));
              if (fs.existsSync(p)) fs.unlink(p, () => {});
            }
          } catch {}
        }
      }
      if (purgedIds.length) {
        try { io.emit("threads:purged", { ids: purgedIds }); } catch {}
      }
      threads = keep;
    };
    setInterval(purgeExpired, 60 * 1000);

    // List threads
    expressApp.get("/threads", (_req, res) => {
      try {
        purgeExpired();
        const data = threads
          .slice()
          .sort((a, b) => b.id - a.id)
          .map((t) => ({
            id: t.id,
            title: t.title,
            body: t.body || "",
            image: t.image,
            sensitive: !!t.sensitive,
            timestamp: t.timestamp,
            expiry: t.expiry,
            views: Number(t.views || 0),
            reactions: t.reactions || {},
            replies: t.replies || [],
          }));
        res.json(data);
      } catch (err) {
        console.error("/threads GET error", err);
        res.status(500).json({ error: "server_error" });
      }
    });

    // Create thread (multipart form)
    expressApp.post("/threads", upload.single("image"), (req, res) => {
      try {
        const title = String(req.body?.title || "").trim();
        const body = String(req.body?.body || "").trim();
        const sensitive = String(req.body?.sensitive || "") === "on";
        if (!title) return res.status(400).json({ error: "title_required" });

        const file = req.file;
        let imagePath = undefined;
        if (file && file.filename) imagePath = "/uploads/" + file.filename;
        const nowISO = new Date().toISOString();
        const expiry = Date.now() + THREAD_TTL_MS;
        const thread = {
          id: nextThreadId++,
          title,
          body,
          image: imagePath,
          sensitive,
          timestamp: nowISO,
          expiry,
          views: 0,
          reactions: {},
          replies: [],
        };
        threads.unshift(thread);
        try { io.emit("thread:new", thread); } catch {}
        res.json(thread);
      } catch (err) {
        console.error("/threads POST error", err);
        res.status(500).json({ error: "server_error" });
      }
    });

    // Add reply (JSON)
    expressApp.post("/threads/:id/replies", (req, res) => {
      try {
        const id = Number(req.params.id);
        const t = threads.find((x) => x.id === id);
        if (!t) return res.status(404).json({ error: "not_found" });
        const text = String(req.body?.text || "").trim();
        if (!text) return res.status(400).json({ error: "text_required" });
        const reply = { id: nextReplyId++, text, timestamp: new Date().toISOString() };
        if (!t.replies) t.replies = [];
        t.replies.push(reply);
        try { io.emit("reply:new", { threadId: t.id, reply }); } catch {}
        res.json(reply);
      } catch (err) {
        console.error("/threads/:id/replies POST error", err);
        res.status(500).json({ error: "server_error" });
      }
    });

    // React to a thread (JSON)
    expressApp.post("/threads/:id/react", (req, res) => {
      try {
        const id = Number(req.params.id);
        const t = threads.find((x) => x.id === id);
        if (!t) return res.status(404).json({ error: "not_found" });
        const emoji = String(req.body?.emoji || "");
        if (!emoji) return res.status(400).json({ error: "emoji_required" });
        if (!t.reactions) t.reactions = {};
        const current = Number(t.reactions[emoji] || 0) + 1;
        t.reactions[emoji] = current;
        try { io.emit("reaction:update", { threadId: t.id, reactions: t.reactions }); } catch {}
        res.json({ reactions: t.reactions });
      } catch (err) {
        console.error("/threads/:id/react POST error", err);
        res.status(500).json({ error: "server_error" });
      }
    });

    // Record a view
    expressApp.post("/threads/:id/view", (req, res) => {
      try {
        const id = Number(req.params.id);
        const t = threads.find((x) => x.id === id);
        if (!t) return res.status(404).json({ error: "not_found" });
        t.views = Number(t.views || 0) + 1;
        res.json({ views: t.views });
      } catch (err) {
        console.error("/threads/:id/view POST error", err);
        res.status(500).json({ error: "server_error" });
      }
    });

    // Most viewed (from currently alive threads = past hour)
    expressApp.get("/threads/most-viewed", (req, res) => {
      try {
        purgeExpired();
        const limit = Math.max(1, Math.min(10, Number(req.query.limit || 4)));
        const data = threads
          .slice()
          .sort((a, b) => Number(b.views || 0) - Number(a.views || 0) || (b.id - a.id))
          .slice(0, limit)
          .map((t) => ({
            id: t.id,
            title: t.title,
            image: t.image,
            sensitive: !!t.sensitive,
            timestamp: t.timestamp,
            expiry: t.expiry,
            views: Number(t.views || 0),
          }));
        res.json(data);
      } catch (err) {
        console.error("/threads/most-viewed GET error", err);
        res.status(500).json({ error: "server_error" });
      }
    });

    // Minimal reports endpoint to avoid client errors
    expressApp.post("/reports", (req, res) => {
      try {
        // placeholder: could log elsewhere
        res.json({ ok: true });
      } catch {
        res.json({ ok: true });
      }
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
