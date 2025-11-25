import express from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import multer from "multer";
import path from "path";
import fs from "fs";
import helmet from "helmet";
import morgan from "morgan";
import nodemailer from "nodemailer";
import { fileURLToPath } from "url";

const DEFAULT_REPORT_EMAIL = "Zacharylinz1013@gmail.com";
const THREAD_TTL_MS = 24 * 60 * 60 * 1000;
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const MEDIA_MAX_BYTES = 100 * 1024 * 1024;

const MEDIA_MIME_TYPES = {
  image: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  video: ["video/mp4", "video/webm", "video/quicktime", "video/ogg"],
  audio: [
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
    "audio/wave",
    "audio/webm",
    "audio/ogg",
    "audio/aac",
    "audio/x-m4a",
    "audio/m4a",
  ],
};

const MIME_TO_MEDIA_TYPE = new Map();
for (const [kind, list] of Object.entries(MEDIA_MIME_TYPES)) {
  for (const mime of list) {
    MIME_TO_MEDIA_TYPE.set(mime, kind);
  }
}

export function attachApiLayer({
  app: expressApp,
  server,
  dev = process.env.NODE_ENV !== "production",
} = {}) {
  if (!expressApp || !server) {
    throw new Error("attachApiLayer requires an Express app and HTTP server");
  }

  const videoRooms = new Map();

  const reportRecipient = process.env.REPORT_EMAIL || DEFAULT_REPORT_EMAIL;
  const smtpUrl = process.env.REPORT_SMTP_URL || process.env.SMTP_URL;
  let reportTransport = nodemailer.createTransport({
    streamTransport: true,
    newline: "unix",
    buffer: true,
  });

  if (smtpUrl) {
    try {
      reportTransport = nodemailer.createTransport(smtpUrl);
    } catch (error) {
      console.error("Failed to configure SMTP transport from REPORT_SMTP_URL/SMTP_URL", error);
    }
  }

  expressApp.use(
    helmet({
      contentSecurityPolicy: dev
        ? false
        : {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "blob:"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", "data:", "blob:"],
              connectSrc: ["'self'", "ws:", "wss:"],
              fontSrc: ["'self'", "data:"],
              objectSrc: ["'none'"],
              frameAncestors: ["'self'"],
              workerSrc: ["'self'", "blob:"],
            },
          },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );
  expressApp.use(morgan("tiny"));
  expressApp.use(express.json({ limit: "1mb" }));
    expressApp.use(express.urlencoded({ extended: true }));
    const allowedOrigin = process.env.API_ALLOW_ORIGIN || "*";
    expressApp.use((req, res, next) => {
      res.header("Access-Control-Allow-Origin", allowedOrigin);
      res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type, Accept");
      if (req.method === "OPTIONS") {
        return res.sendStatus(204);
      }
      next();
    });

    const uploadsDir = path.join(process.cwd(), "uploads");
  try {
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  } catch {}
  expressApp.use("/uploads", express.static(uploadsDir, { fallthrough: true }));

  let nextThreadId = 1;
  let nextReplyId = 1;
  const threadCodes = new Set();
  let threads = [];

  const detectMediaType = (rawMime = "") => {
    try {
      const mime = String(rawMime || "").toLowerCase();
      if (!mime) return undefined;
      if (MIME_TO_MEDIA_TYPE.has(mime)) return MIME_TO_MEDIA_TYPE.get(mime);
      if (mime.startsWith("image/")) return "image";
      if (mime.startsWith("video/")) return "video";
      if (mime.startsWith("audio/")) return "audio";
    } catch {}
    return undefined;
  };

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
    limits: { fileSize: MEDIA_MAX_BYTES },
    fileFilter: (_req, file, cb) => {
      try {
        const mime = String(file.mimetype || "").toLowerCase();
        const mediaType = detectMediaType(mime);
        if (mediaType) file.detectedMediaType = mediaType;
        const ok = !!mediaType;
        cb(ok ? null : new Error("INVALID_FILE"), ok);
      } catch {
        cb(null, true);
      }
    },
  });

  const io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  const generateThreadCode = () => {
    let attempt = 0;
    while (attempt < 10) {
      const base = (
        Date.now().toString(36) + Math.random().toString(36).slice(2)
      )
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
      const candidate =
        base.slice(0, 8) || Math.random().toString(36).slice(2, 10).toUpperCase();
      if (!threadCodes.has(candidate)) {
        threadCodes.add(candidate);
        return candidate;
      }
      attempt += 1;
    }
    const fallback = Math.random().toString(36).slice(2, 10).toUpperCase();
    threadCodes.add(fallback);
    return fallback;
  };

  io.on("connection", (socket) => {
    console.log("🚀 User connected:", socket.id);

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
      console.log("⚠️ User disconnected:", socket.id);
    });
  });

  const purgeExpired = () => {
    const now = Date.now();
    const keep = [];
    const purgedIds = [];
    for (const t of threads) {
      const end =
        typeof t.expiry === "number"
          ? t.expiry
          : new Date(t.timestamp).getTime() + THREAD_TTL_MS;
      if (end > now) {
        keep.push(t);
      } else {
        purgedIds.push(t.id);
        if (t.code) threadCodes.delete(t.code);
        try {
          if (t.image && t.image.startsWith("/uploads/")) {
            const p = path.join(uploadsDir, t.image.replace("/uploads/", ""));
            if (fs.existsSync(p)) fs.unlink(p, () => {});
          }
        } catch {}
      }
    }
    if (purgedIds.length) {
      try {
        io.emit("threads:purged", { ids: purgedIds });
      } catch {}
    }
    threads = keep;
  };
  setInterval(purgeExpired, 60 * 1000);

  const listThreads = (_req, res) => {
    try {
      purgeExpired();
      const data = threads
        .slice()
        .sort((a, b) => b.id - a.id)
        .map((t) => ({
          id: t.id,
          code: t.code,
          title: t.title,
          body: t.body || "",
          image: t.image,
          mediaType: t.mediaType || (t.image ? "image" : undefined),
          mediaMime: t.mediaMime,
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
  };
  expressApp.get("/threads", listThreads);

  const cleanupUpload = (file) => {
    try {
      if (!file) return;
      const filePath =
        file.path || (file.filename ? path.join(uploadsDir, file.filename) : null);
      if (!filePath) return;
      fs.unlink(filePath, () => {});
    } catch {}
  };

  const createThread = (req, res) => {
    try {
      const title = String(req.body?.title || "").trim();
      const body = String(req.body?.body || "").trim();
      const sensitive = String(req.body?.sensitive || "") === "on";
      if (!title) return res.status(400).json({ error: "title_required" });

      const file = req.file;
      let imagePath = undefined;
      let mediaType = undefined;
      let mediaMime = undefined;
      if (file && file.filename) {
        imagePath = "/uploads/" + file.filename;
        mediaMime = file.mimetype ? String(file.mimetype).toLowerCase() : undefined;
        mediaType = file.detectedMediaType || detectMediaType(mediaMime);
        const fileSize = Number(file.size || 0);
        const typeForLimit = mediaType || "image";
        const limitBytes = typeForLimit === "image" ? IMAGE_MAX_BYTES : MEDIA_MAX_BYTES;
        if (fileSize > limitBytes) {
          cleanupUpload(file);
          const errorCode = typeForLimit === "image" ? "image_too_large" : "media_too_large";
          return res.status(400).json({
            error: errorCode,
            limitBytes,
          });
        }
      }
      const nowISO = new Date().toISOString();
      const expiry = Date.now() + THREAD_TTL_MS;
      const thread = {
        id: nextThreadId++,
        code: generateThreadCode(),
        title,
        body,
        image: imagePath,
        mediaType,
        mediaMime,
        sensitive,
        timestamp: nowISO,
        expiry,
        views: 0,
        reactions: {},
        replies: [],
      };
      threads.unshift(thread);
      try {
        io.emit("thread:new", thread);
      } catch {}
      res.json(thread);
    } catch (err) {
      console.error("/threads POST error", err);
      res.status(500).json({ error: "server_error" });
    }
  };
  expressApp.post("/threads", upload.single("image"), createThread);

  const addReply = (req, res) => {
    try {
      const id = Number(req.params.id);
      const t = threads.find((x) => x.id === id);
      if (!t) return res.status(404).json({ error: "not_found" });
      const text = String(req.body?.text || "").trim();
      if (!text) return res.status(400).json({ error: "text_required" });
      const reply = { id: nextReplyId++, text, timestamp: new Date().toISOString() };
      if (!t.replies) t.replies = [];
      t.replies.push(reply);
      try {
        io.emit("reply:new", { threadId: t.id, reply });
      } catch {}
      res.json(reply);
    } catch (err) {
      console.error("/threads/:id/replies POST error", err);
      res.status(500).json({ error: "server_error" });
    }
  };
  expressApp.post("/threads/:id/replies", addReply);

  const reactThread = (req, res) => {
    try {
      const id = Number(req.params.id);
      const t = threads.find((x) => x.id === id);
      if (!t) return res.status(404).json({ error: "not_found" });
      const emoji = String(req.body?.emoji || "");
      if (!emoji) return res.status(400).json({ error: "emoji_required" });
      if (!t.reactions) t.reactions = {};
      const current = Number(t.reactions[emoji] || 0) + 1;
      t.reactions[emoji] = current;
      try {
        io.emit("reaction:update", { threadId: t.id, reactions: t.reactions });
      } catch {}
      res.json({ reactions: t.reactions });
    } catch (err) {
      console.error("/threads/:id/react POST error", err);
      res.status(500).json({ error: "server_error" });
    }
  };
  expressApp.post("/threads/:id/react", reactThread);

  const recordView = (req, res) => {
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
  };
  expressApp.post("/threads/:id/view", recordView);

  const mostViewed = (req, res) => {
    try {
      purgeExpired();
      const limit = Math.max(1, Math.min(10, Number(req.query.limit || 4)));
      const data = threads
        .slice()
        .sort((a, b) => Number(b.views || 0) - Number(a.views || 0) || b.id - a.id)
        .slice(0, limit)
        .map((t) => ({
          id: t.id,
          code: t.code,
          title: t.title,
          image: t.image,
          mediaType: t.mediaType || (t.image ? "image" : undefined),
          mediaMime: t.mediaMime,
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
  };
  expressApp.get("/threads/most-viewed", mostViewed);

  expressApp.post("/reports", async (req, res) => {
    try {
      const { category, impact, link, details, contact } = req.body || {};
      const text = [
        `Category: ${category || "unspecified"}`,
        `Impact: ${impact || "unspecified"}`,
        `Link: ${link || "n/a"}`,
        "",
        "Details:",
        details || "No description provided.",
        "",
        `Contact: ${contact || "not provided"}`,
      ].join("\n");

      const info = await reportTransport.sendMail({
        to: reportRecipient,
        from: process.env.REPORT_FROM_EMAIL || "no-reply@lurk.app",
        subject: `Lurk report (${category || "general"})`,
        text,
      });

      const delivered = !Array.isArray(info?.rejected) || info.rejected.length === 0;
      res.json({ ok: true, delivered });
    } catch (err) {
      console.error("Report email failed", err);
      res.status(500).json({ error: "report_failed" });
    }
  });

  expressApp.use((err, _req, res, next) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "media_too_large", limitBytes: MEDIA_MAX_BYTES });
    }
    if (err.message === "INVALID_FILE") {
      return res.status(400).json({ error: "invalid_file_type" });
    }
    console.error("Upload middleware error:", err);
    return res.status(500).json({ error: "server_error" });
  });

  return { io };
}

export async function startApiService({
  app: providedApp,
  server: providedServer,
  dev,
  port = process.env.API_PORT || 4000,
  host = process.env.API_HOST || "0.0.0.0",
} = {}) {
  const expressApp = providedApp || express();
  const httpServer = providedServer || http.createServer(expressApp);
  attachApiLayer({ app: expressApp, server: httpServer, dev });
  await new Promise((resolve) => httpServer.listen(port, host, resolve));
  console.log(`🚀 API service listening on ${host}:${port}`);
  return { app: expressApp, server: httpServer };
}

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  startApiService().catch((err) => {
    console.error("Fatal API startup error:", err);
    process.exit(1);
  });
}
