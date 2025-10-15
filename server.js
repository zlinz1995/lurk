// server.js
import express from "express";
import http from "http";
import { Server } from "socket.io";
import next from "next";

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

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
      socket.on("chat message", (msg) => {
        io.emit("chat message", msg);
      });
      socket.on("disconnect", () => {
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
