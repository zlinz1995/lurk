// server.js
import express from "express";
import http from "http";
import { Server } from "socket.io";
import next from "next";

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const expressApp = express();
  const server = http.createServer(expressApp);

  // --- Socket.IO setup ---
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("✅ User connected:", socket.id);
    socket.on("disconnect", () => {
      console.log("❌ User disconnected:", socket.id);
    });
  });

  // --- Let Next.js handle all routes ---
  expressApp.all("*", (req, res) => handle(req, res));

  // --- Critical part: Render port binding ---
  const PORT = process.env.PORT || 8080;
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Lurk running on port ${PORT}`);
  });
});
