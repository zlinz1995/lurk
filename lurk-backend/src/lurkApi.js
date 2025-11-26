import fs from "fs";
import path from "path";
import http from "http";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import multer from "multer";
import mime from "mime-types";
import Database from "better-sqlite3";
import helmet from "helmet";
import morgan from "morgan";
import { Server as SocketIOServer } from "socket.io";

const THREAD_TTL_MS = Number(process.env.THREAD_TTL_MS || 24 * 60 * 60 * 1000);
const MAX_MEDIA_BYTES = Number(process.env.MAX_MEDIA_BYTES || 15 * 1024 * 1024);
const DATA_DIR = process.env.DATA_DIR || "/tmp/lurk-data";
const DB_PATH = path.join(DATA_DIR, process.env.DB_NAME || "threads.db");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const ALLOWED_MEDIA_PREFIXES = ["image/", "video/", "audio/"];
const RATE_LIMIT_WINDOW = Number(process.env.RATE_LIMIT_WINDOW_MS || 60 * 1000);
const RATE_LIMIT_STANDARD_HEADERS = true;
const RATE_LIMIT_LEGACY_HEADERS = false;
const REACT_MEMORY_TTL = Number(process.env.REACT_TTL_MS || 24 * 60 * 60 * 1000);
const reactMemory = new Map(); // key: `${threadId}:${ip}`, value: timestamp

const createLimiter = ({
  windowMs = RATE_LIMIT_WINDOW,
  limit = 60,
  message = { error: "too_many_requests" },
  keyGenerator,
} = {}) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: RATE_LIMIT_STANDARD_HEADERS,
    legacyHeaders: RATE_LIMIT_LEGACY_HEADERS,
    message,
    keyGenerator,
  });

const readLimiter = createLimiter({ limit: 240 });
const writeLimiter = createLimiter({ windowMs: 5 * 60 * 1000, limit: 30 });
const reactLimiter = createLimiter({ windowMs: 60 * 1000, limit: 90 });
const reportLimiter = createLimiter({ windowMs: 10 * 60 * 1000, limit: 5 });

export function attachApiLayer({ app, server, dev = false } = {}) {
  if (!app || !server) {
    throw new Error("attachApiLayer requires an Express app and HTTP server");
  }

  ensureDirectories();
  resetDatabase();
  const db = new Database(DB_PATH);
  prepareSchema(db);
  purgeExpiredThreads(db);
  setInterval(() => purgeExpiredThreads(db), 30 * 60 * 1000).unref();

  app.set("trust proxy", true);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );
  app.use(
    cors({
      origin: "*",
      methods: ["GET", "POST", "OPTIONS"],
    })
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan(dev ? "dev" : "tiny"));
  app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: dev ? 0 : "7d" }));

  const upload = createUploadMiddleware();
  const withUpload = (req, res, next) => {
    upload(req, res, (err) => {
      if (err) {
        handleUploadError(err, res);
        return;
      }
      next();
    });
  };

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.get("/threads", readLimiter, (_req, res) => {
    purgeExpiredThreads(db);
    const rows = db
      .prepare(
        `
        SELECT id, code, title, body, image_filename, media_type, media_mime, sensitive,
               views, reactions, created_at, expires_at
        FROM threads
        ORDER BY datetime(created_at) DESC
        LIMIT 100
      `
      )
      .all();
    res.json(rows.map((row) => serializeThread(row, db)));
  });

  app.get("/threads/most-viewed", readLimiter, (req, res) => {
    purgeExpiredThreads(db);
    const limit = clampInt(req.query?.limit, 1, 24) || 4;
    const rows = db
      .prepare(
        `
        SELECT id, code, title, body, image_filename, media_type, media_mime, sensitive,
               views, reactions, created_at, expires_at
        FROM threads
        ORDER BY views DESC, datetime(created_at) DESC
        LIMIT ?
      `
      )
      .all(limit);
    res.json(rows.map((row) => serializeThread(row, db)));
  });

  app.post("/threads", writeLimiter, withUpload, (req, res) => {
    const text = sanitizeText(req.body?.title || req.body?.body || req.body?.text || "");
    if (!text) {
      cleanupMedia(req.file?.filename);
      return res.status(400).json({ error: "title_required" });
    }

    const sensitive = req.body?.sensitive === "on" ? 1 : 0;
    const now = new Date();
    const createdAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + THREAD_TTL_MS).toISOString();
    const code = generateCode();
    const media = describeMedia(req.file);

    try {
      const result = db
        .prepare(
          `
          INSERT INTO threads (code, title, body, image_filename, media_type, media_mime,
                               sensitive, views, reactions, expires_at, created_at)
          VALUES (@code, @title, @body, @image_filename, @media_type, @media_mime,
                  @sensitive, @views, @reactions, @expires_at, @created_at)
        `
        )
        .run({
          code,
          title: text,
          body: text,
          image_filename: media?.filename || null,
          media_type: media?.type || null,
          media_mime: media?.mime || null,
          sensitive,
          views: 0,
          reactions: "{}",
          expires_at: expiresAt,
          created_at: createdAt,
        });

      const created = db
        .prepare(
          `
          SELECT id, code, title, body, image_filename, media_type, media_mime, sensitive,
                 views, reactions, created_at, expires_at
          FROM threads WHERE id = ?
        `
        )
        .get(result.lastInsertRowid);

      res.status(201).json(serializeThread(created, db));
    } catch (error) {
      console.error("Failed to create thread", error);
      cleanupMedia(req.file?.filename);
      res.status(500).json({ error: "server_error" });
    }
  });

  app.post("/threads/:id/replies", writeLimiter, (req, res) => {
    const threadId = Number(req.params.id);
    if (!Number.isInteger(threadId)) {
      return res.status(400).json({ error: "invalid_thread" });
    }

    const thread = db
      .prepare("SELECT id FROM threads WHERE id = ? LIMIT 1")
      .get(threadId);
    if (!thread) {
      return res.status(404).json({ error: "not_found" });
    }

    const text = sanitizeText(req.body?.text || "");
    if (!text) {
      return res.status(400).json({ error: "text_required" });
    }

    const createdAt = new Date().toISOString();
    try {
      const result = db
        .prepare(
          `
          INSERT INTO posts (thread_id, body, created_at)
          VALUES (?, ?, ?)
        `
        )
        .run(threadId, text, createdAt);

      res.status(201).json({
        id: result.lastInsertRowid,
        text,
        timestamp: createdAt,
      });
    } catch (error) {
      console.error("Failed to add reply", error);
      res.status(500).json({ error: "server_error" });
    }
  });

  app.post("/threads/:id/react", reactLimiter, (req, res) => {
    const threadId = Number(req.params.id);
    if (!Number.isInteger(threadId)) {
      return res.status(400).json({ error: "invalid_thread" });
    }

    const emoji = sanitizeEmoji(req.body?.emoji || "");
    if (!emoji) {
      return res.status(400).json({ error: "emoji_required" });
    }

    const clientIp = req.ip || req.connection?.remoteAddress || "unknown";
    const reactKey = `${threadId}:${clientIp}`;
    const nowMs = Date.now();
    pruneReactionMemory(nowMs);
    if (reactMemory.has(reactKey)) {
      return res.status(429).json({ error: "already_reacted" });
    }

    const thread = db
      .prepare("SELECT id, reactions FROM threads WHERE id = ? LIMIT 1")
      .get(threadId);
    if (!thread) {
      return res.status(404).json({ error: "not_found" });
    }

    const reactions = safeJsonParse(thread.reactions, {});
    reactions[emoji] = Number(reactions[emoji] || 0) + 1;

    try {
      db.prepare("UPDATE threads SET reactions = ? WHERE id = ?").run(
        JSON.stringify(reactions),
        threadId
      );
      reactMemory.set(reactKey, nowMs);
      res.json({ reactions });
    } catch (error) {
      console.error("Failed to record reaction", error);
      res.status(500).json({ error: "server_error" });
    }
  });

  app.post("/threads/:id/view", reactLimiter, (req, res) => {
    const threadId = Number(req.params.id);
    if (!Number.isInteger(threadId)) {
      return res.status(400).json({ error: "invalid_thread" });
    }

    const result = db
      .prepare("UPDATE threads SET views = COALESCE(views, 0) + 1 WHERE id = ?")
      .run(threadId);
    if (!result.changes) {
      return res.status(404).json({ error: "not_found" });
    }

    const updated = db
      .prepare("SELECT views FROM threads WHERE id = ? LIMIT 1")
      .get(threadId);
    res.json({ views: Number(updated?.views || 0) });
  });

  app.post("/reports", reportLimiter, (req, res) => {
    const payload = {
      category: sanitizeText(req.body?.category || "", 64),
      impact: sanitizeText(req.body?.impact || "", 64),
      link: sanitizeText(req.body?.link || "", 256),
      details: sanitizeText(req.body?.details || "", 2000),
      contact: sanitizeText(req.body?.contact || "", 128),
    };

    if (!payload.category || !payload.impact || !payload.link || !payload.details) {
      return res.status(400).json({ error: "missing_fields" });
    }

    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS reports (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          category TEXT NOT NULL,
          impact TEXT NOT NULL,
          link TEXT NOT NULL,
          details TEXT NOT NULL,
          contact TEXT,
          created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        );
      `);

      db.prepare(
        `
        INSERT INTO reports (category, impact, link, details, contact)
        VALUES (?, ?, ?, ?, ?)
      `
      ).run(payload.category, payload.impact, payload.link, payload.details, payload.contact);

      res.status(201).json({ ok: true });
    } catch (error) {
      console.error("Failed to record report", error);
      res.status(500).json({ error: "server_error" });
    }
  });

  setupSockets(server);

  return { db };
}

function createUploadMiddleware() {
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext =
        (mime.extension(file.mimetype) || path.extname(file.originalname) || "bin")
          .toString()
          .replace(/[^a-zA-Z0-9.]/g, "") || "bin";
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}.${ext}`);
    },
  });

  return multer({
    storage,
    limits: { fileSize: MAX_MEDIA_BYTES },
    fileFilter: (_req, file, cb) => {
      if (!file?.mimetype) {
        cb(new Error("invalid_file_type"));
        return;
      }
      const allowed = ALLOWED_MEDIA_PREFIXES.some((prefix) =>
        file.mimetype.startsWith(prefix)
      );
      if (!allowed) {
        cb(new Error("invalid_file_type"));
        return;
      }
      cb(null, true);
    },
  }).single("image");
}

function handleUploadError(err, res) {
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    res.status(400).json({ error: "media_too_large" });
    return;
  }
  if (err?.message === "invalid_file_type") {
    res.status(400).json({ error: "invalid_file_type" });
    return;
  }
  console.error("Upload failed", err);
  res.status(400).json({ error: "upload_failed" });
}

function describeMedia(file) {
  if (!file) return null;
  const type = classifyMediaType(file.mimetype);
  return {
    filename: file.filename,
    mime: file.mimetype,
    type,
  };
}

function classifyMediaType(mimeType) {
  if (!mimeType) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "image";
}

function ensureDirectories() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function resetDatabase() {
  const targets = [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`];
  targets.forEach((target) => {
    try {
      if (fs.existsSync(target)) {
        fs.unlinkSync(target);
      }
    } catch (error) {
      console.warn("Could not clear database file", target, error?.code || error?.message || error);
    }
  });
}

function prepareSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS threads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT,
      image_filename TEXT,
      created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      thread_id INTEGER NOT NULL,
      body TEXT,
      image_filename TEXT,
      created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      FOREIGN KEY(thread_id) REFERENCES threads(id) ON DELETE CASCADE
    );
  `);

  ensureColumns(db, "threads", [
    { name: "code", type: "TEXT" },
    { name: "media_type", type: "TEXT" },
    { name: "media_mime", type: "TEXT" },
    { name: "sensitive", type: "INTEGER", defaultValue: 0 },
    { name: "views", type: "INTEGER", defaultValue: 0 },
    { name: "reactions", type: "TEXT", defaultValue: "'{}'" },
    { name: "expires_at", type: "DATETIME" },
  ]);

  ensureColumns(db, "posts", []);

  db.prepare(
    "UPDATE threads SET views = 0 WHERE views IS NULL OR views = ''"
  ).run();
  db.prepare(
    "UPDATE threads SET reactions = '{}' WHERE reactions IS NULL OR reactions = ''"
  ).run();
  db.prepare(
    "UPDATE threads SET sensitive = 0 WHERE sensitive IS NULL"
  ).run();
  db.prepare(
    "UPDATE threads SET expires_at = COALESCE(expires_at, datetime(created_at, '+1 day'))"
  ).run();
  db.prepare(
    "UPDATE threads SET code = COALESCE(code, substr('0000' || id, -4))"
  ).run();
}

function ensureColumns(db, table, columns = []) {
  const existing = new Set(
    db.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name)
  );
  columns.forEach((column) => {
    if (existing.has(column.name)) return;
    const defaultClause =
      column.defaultValue === undefined ? "" : ` DEFAULT ${column.defaultValue}`;
    db.prepare(
      `ALTER TABLE ${table} ADD COLUMN ${column.name} ${column.type}${defaultClause}`
    ).run();
  });
}

function purgeExpiredThreads(db) {
  const nowIso = new Date().toISOString();
  const expired = db
    .prepare(
      "SELECT id, image_filename FROM threads WHERE expires_at IS NOT NULL AND expires_at <= ?"
    )
    .all(nowIso);

  if (!expired.length) return;

  const deleteThread = db.prepare("DELETE FROM threads WHERE id = ?");
  expired.forEach((row) => {
    deleteThread.run(row.id);
    cleanupMedia(row.image_filename);
  });
}

function serializeThread(row, db) {
  const reactions = safeJsonParse(row?.reactions, {});
  const mediaType = row?.media_type || classifyMediaType(row?.media_mime);
  const replies = getReplies(db, row?.id);
  let expiryMs = null;
  if (row?.expires_at) {
    const ts = new Date(row.expires_at).getTime();
    expiryMs = Number.isNaN(ts) ? null : ts;
  }

  return {
    id: row?.id,
    code: row?.code || (row?.id ? String(row.id).padStart(4, "0") : undefined),
    title: row?.title || row?.body || "",
    body: row?.body || row?.title || "",
    image: row?.image_filename ? `/uploads/${row.image_filename}` : null,
    mediaType,
    mediaMime: row?.media_mime || null,
    sensitive: Boolean(row?.sensitive),
    timestamp: row?.created_at,
    expiry: expiryMs,
    views: Number(row?.views || 0),
    replies,
    reactions,
  };
}

function getReplies(db, threadId) {
  if (!threadId) return [];
  return db
    .prepare(
      `
      SELECT id, body, created_at
      FROM posts
      WHERE thread_id = ?
      ORDER BY datetime(created_at) ASC
    `
    )
    .all(threadId)
    .map((row) => ({
      id: row.id,
      text: row.body,
      timestamp: row.created_at,
    }));
}

function cleanupMedia(filename) {
  if (!filename) return;
  const filePath = path.join(UPLOAD_DIR, filename);
  fs.promises.unlink(filePath).catch(() => {});
}

function safeJsonParse(value, fallback) {
  if (!value || typeof value !== "string") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function sanitizeText(value, limit = 500) {
  if (!value) return "";
  const str = String(value).trim();
  return str.slice(0, limit);
}

function sanitizeEmoji(value) {
  if (!value) return "";
  const str = String(value).trim();
  return str.slice(0, 8);
}

function generateCode() {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

function clampInt(input, min, max) {
  const num = Number.parseInt(input, 10);
  if (Number.isNaN(num)) return null;
  return Math.max(min, Math.min(max, num));
}

function setupSockets(server) {
  if (server.__lurk_io) return server.__lurk_io;

  const io = new SocketIOServer(server, {
    path: "/socket.io",
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });
  server.__lurk_io = io;

  const videoRooms = new Map();

  io.on("connection", (socket) => {
    let joinedRoom = null;
    let displayName = null;

    socket.on("chat message", (payload = {}) => {
      const message = {
        id: payload.id || `${socket.id}-${Date.now()}`,
        text: sanitizeText(payload.text || "", 500),
        name: sanitizeText(payload.name || "Guest", 64),
        ts: payload.ts || Date.now(),
      };
      if (!message.text) return;
      io.emit("chat message", message);
    });

    socket.on("join-video-room", ({ roomId = "global-video-room", name } = {}) => {
      const roomKey = roomId || "global-video-room";
      displayName = sanitizeText(name || `Guest-${socket.id.slice(-4)}`, 64);
      joinedRoom = roomKey;
      socket.join(roomKey);

      const room = videoRooms.get(roomKey) || new Map();
      room.set(socket.id, { name: displayName });
      videoRooms.set(roomKey, room);

      const existing = Array.from(room.entries())
        .filter(([peerId]) => peerId !== socket.id)
        .map(([peerId, meta]) => ({ peerId, name: meta?.name }));

      socket.emit("video-existing-peers", existing);
      socket.to(roomKey).emit("video-peer-joined", {
        peerId: socket.id,
        name: displayName,
      });
    });

    const leaveRoom = () => {
      if (!joinedRoom) return;
      const room = videoRooms.get(joinedRoom);
      const meta = room?.get(socket.id);
      if (room) {
        room.delete(socket.id);
        if (!room.size) {
          videoRooms.delete(joinedRoom);
        }
      }
      socket.leave(joinedRoom);
      socket.to(joinedRoom).emit("video-peer-left", {
        peerId: socket.id,
        name: meta?.name,
      });
      joinedRoom = null;
    };

    socket.on("leave-video-room", leaveRoom);
    socket.on("disconnect", leaveRoom);

    ["video-offer", "video-answer", "video-ice-candidate"].forEach((eventName) => {
      socket.on(eventName, (payload = {}) => {
        const target = payload.to;
        if (!target) return;
        socket.to(target).emit(eventName, {
          from: socket.id,
          ...payload,
        });
      });
    });
  });

  return io;
}

function pruneReactionMemory(nowMs = Date.now()) {
  const cutoff = nowMs - REACT_MEMORY_TTL;
  reactMemory.forEach((ts, key) => {
    if (ts < cutoff) {
      reactMemory.delete(key);
    }
  });
}

export function createApiServer({ port = 4000, dev = false } = {}) {
  const expressApp = express();
  const httpServer = http.createServer(expressApp);
  attachApiLayer({ app: expressApp, server: httpServer, dev });
  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`Lurk API listening on port ${port}`);
  });
  return { app: expressApp, server: httpServer };
}
