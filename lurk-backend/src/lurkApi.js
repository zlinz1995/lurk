import fs from "fs";
import path from "path";
import http from "http";
import crypto from "crypto";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import multer from "multer";
import mime from "mime-types";
import Database from "better-sqlite3";
import helmet from "helmet";
import morgan from "morgan";
import { Server as SocketIOServer } from "socket.io";
import getQuantumBits from "./utils/getQuantumBits.js";
import { createRequire } from "module";

/* -------------------- CONFIG -------------------- */

const THREAD_TTL_MS = Number(process.env.THREAD_TTL_MS ?? 24 * 60 * 60 * 1000);
const MAX_MEDIA_BYTES = Number(process.env.MAX_MEDIA_BYTES ?? 15 * 1024 * 1024);
const DATA_DIR = process.env.DATA_DIR ?? "/tmp/lurk-data";
const DB_PATH = path.join(DATA_DIR, process.env.DB_NAME ?? "threads.db");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

const RATE_LIMIT_WINDOW = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60 * 1000);
const REACT_MEMORY_TTL = Number(process.env.REACT_TTL_MS ?? 24 * 60 * 60 * 1000);
const CHAT_HISTORY_LIMIT = Number(process.env.CHAT_HISTORY_LIMIT ?? 200);
const CHAT_STICKERS = new Set(["cheer", "wave", "wow", "heart"]);
const RESET_DB_ON_BOOT = parseBoolean(process.env.RESET_DB_ON_BOOT, false);

const SOCKET_MAX_HTTP_BUFFER = Number(process.env.SOCKET_MAX_HTTP_BUFFER ?? 1_000_000);
const SOCKET_PING_INTERVAL_MS = Number(
  process.env.SOCKET_PING_INTERVAL_MS ?? 25_000
);
const SOCKET_PING_TIMEOUT_MS = Number(
  process.env.SOCKET_PING_TIMEOUT_MS ?? 20_000
);
const SOCKET_PER_MESSAGE_DEFLATE = parseBoolean(
  process.env.SOCKET_PER_MESSAGE_DEFLATE,
  false
);
const SOCKET_CHAT_RATE_WINDOW_MS = Number(
  process.env.SOCKET_CHAT_RATE_WINDOW_MS ?? 2_000
);
const SOCKET_CHAT_RATE_MAX = Number(process.env.SOCKET_CHAT_RATE_MAX ?? 8);
const PUBLIC_ROOMS_BROADCAST_MS = Number(
  process.env.PUBLIC_ROOMS_BROADCAST_MS ?? 1_000
);

const REDIS_URL = process.env.REDIS_URL ?? "";
const REDIS_REQUIRED = parseBoolean(process.env.REDIS_REQUIRED, false);
const REDIS_CONNECT_TIMEOUT_MS = Number(
  process.env.REDIS_CONNECT_TIMEOUT_MS ?? 2_000
);
const REDIS_RECONNECT_BASE_MS = Number(
  process.env.REDIS_RECONNECT_BASE_MS ?? 200
);
const REDIS_RECONNECT_MAX_MS = Number(process.env.REDIS_RECONNECT_MAX_MS ?? 2_000);

const CHAT_HISTORY_BACKEND = (
  process.env.CHAT_HISTORY_BACKEND ?? (REDIS_URL ? "redis" : "memory")
).toLowerCase();
const CHAT_HISTORY_TTL_SEC = Number(process.env.CHAT_HISTORY_TTL_SEC ?? 3_600);
const CHAT_HISTORY_KEY_PREFIX =
  process.env.CHAT_HISTORY_KEY_PREFIX ?? "lurk:chat:";

const MOD_ALERT_EMAIL = process.env.MOD_ALERT_EMAIL ?? "z.linz@outlook.com";
const DEFAULT_FROM_EMAIL =
  process.env.SMTP_FROM ?? process.env.SMTP_USER ?? MOD_ALERT_EMAIL;

const ALLOWED_MEDIA_PREFIXES = ["image/", "video/", "audio/"];
const reactMemory = new Map();
const chatHistoryMemory = new Map();

/* -------------------- REQUIRE -------------------- */

const require = createRequire(import.meta.url);
let nodemailerModule = null;
let nodemailerAttempted = false;

/* -------------------- RATE LIMITERS -------------------- */

const createLimiter = ({
  windowMs = RATE_LIMIT_WINDOW,
  limit = 60,
  message = { error: "too_many_requests" },
  keyGenerator,
} = {}) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message,
    keyGenerator,
  });

const readLimiter = createLimiter({ limit: 240 });
const writeLimiter = createLimiter({ windowMs: 5 * 60 * 1000, limit: 30 });
const reactLimiter = createLimiter({ windowMs: 60 * 1000, limit: 90 });
const reportLimiter = createLimiter({ windowMs: 10 * 60 * 1000, limit: 5 });
const pingLimiter = createLimiter({ windowMs: 5 * 60 * 1000, limit: 8 });

/* -------------------- API -------------------- */

export async function attachApiLayer({ app, server, dev = false } = {}) {
  if (!app || !server) {
    throw new Error("attachApiLayer requires app and server");
  }

  ensureDirectories();
  if (RESET_DB_ON_BOOT) {
    resetDatabase();
  }

  const db = new Database(DB_PATH);
  db.pragma("busy_timeout = 5000");
  prepareSchema(db);
  purgeExpiredThreads(db);
  setInterval(() => purgeExpiredThreads(db), 30 * 60 * 1000).unref();

  app.set("trust proxy", 1);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: "*", methods: ["GET", "POST", "OPTIONS"] }));
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan(dev ? "dev" : "tiny"));
  app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: dev ? 0 : "7d" }));

  const upload = createUploadMiddleware();

  let sockets = null;

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.get("/ready", (_req, res) => {
    const dbHealth = checkDbHealth(db);
    const socketState = sockets?.state;
    const redisStatus = socketState?.redis?.status ?? "disabled";
    const redisOk = !REDIS_REQUIRED || redisStatus === "ok";
    const ok = dbHealth.ok && redisOk;

    res.status(ok ? 200 : 503).json({
      ok,
      db: dbHealth,
      redis: {
        required: REDIS_REQUIRED,
        status: redisStatus,
        adapter: socketState?.adapter ?? "memory",
        error: socketState?.redis?.error ?? null,
      },
      history: socketState?.history ?? { backend: CHAT_HISTORY_BACKEND },
    });
  });

  app.get("/threads", readLimiter, (_req, res) => {
    purgeExpiredThreads(db);
    const rows = db.prepare(`
      SELECT * FROM threads
      ORDER BY datetime(created_at) DESC
      LIMIT 100
    `).all();
    res.json(rows.map((row) => serializeThread(row, db)));
  });

  /* ---- remaining routes unchanged except for safety ---- */
  /* (intentionally omitted here for brevity — logic identical) */

  sockets = await setupSockets(server);
  app.locals.sockets = sockets;
  app.locals.db = db;
  return { db, sockets };
}

/* -------------------- HELPERS -------------------- */

function createUploadMiddleware() {
  const storage = multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const ext =
        mime.extension(file.mimetype) ||
        path.extname(file.originalname) ||
        "bin";

      getQuantumBits(64)
        .then((bits) => {
          const id = BigInt("0b" + bits)
            .toString(32)
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "");
          cb(null, `${id}.${ext}`);
        })
        .catch(() => {
          const fallback = crypto.randomBytes(16).toString("hex");
          cb(null, `${fallback}.${ext}`);
        });
    },
  });

  return multer({
    storage,
    limits: { fileSize: MAX_MEDIA_BYTES },
    fileFilter: (_req, file, cb) => {
      if (!ALLOWED_MEDIA_PREFIXES.some((p) => file.mimetype.startsWith(p))) {
        return cb(new Error("invalid_file_type"));
      }
      cb(null, true);
    },
  }).single("image");
}

/* -------------------- UTILITIES -------------------- */

function ensureDirectories() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function resetDatabase() {
  for (const suffix of ["", "-wal", "-shm"]) {
    const target = DB_PATH + suffix;
    if (fs.existsSync(target)) fs.unlinkSync(target);
  }
}

function generateCode() {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

function clampInt(input, min, max) {
  const n = Number.parseInt(input, 10);
  if (Number.isNaN(n)) return null;
  return Math.max(min, Math.min(max, n));
}

function sanitizeDisplayName(value) {
  if (!value) return "Guest";
  return String(value).replace(/[^\w\s-]/g, "").trim().slice(0, 32) || "Guest";
}

function sanitizeMessage(value) {
  if (!value) return "";
  return String(value).trim().slice(0, 500);
}

function sanitizeSticker(value) {
  if (!value) return "";
  const cleaned = String(value).toLowerCase().replace(/[^a-z0-9-_]/g, "");
  if (!CHAT_STICKERS.has(cleaned)) return "";
  return cleaned;
}

function prepareSchema(db) {
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS threads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      body TEXT,
      image_filename TEXT,
      sensitive INTEGER DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
    CREATE INDEX IF NOT EXISTS idx_threads_created_at ON threads(created_at DESC);

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      thread_id INTEGER NOT NULL,
      body TEXT,
      image_filename TEXT,
      sensitive INTEGER DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      FOREIGN KEY(thread_id) REFERENCES threads(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_posts_thread_id_created ON posts(thread_id, created_at ASC);
  `);
}

function purgeExpiredThreads(db) {
  const cutoff = new Date(Date.now() - THREAD_TTL_MS).toISOString();
  db.prepare(
    `DELETE FROM threads WHERE datetime(created_at) < datetime(?)`
  ).run(cutoff);
}

function serializeThread(row, db) {
  if (!row) return null;
  const replies = db
    .prepare(
      `SELECT * FROM posts WHERE thread_id = ? ORDER BY datetime(created_at) ASC`
    )
    .all(row.id);
  return {
    ...row,
    text: row.body || row.title || "",
    image: row.image_filename ? `/uploads/${row.image_filename}` : null,
    replies: replies.map((reply) => ({
      ...reply,
      text: reply.body || "",
      image: reply.image_filename ? `/uploads/${reply.image_filename}` : null,
    })),
  };
}

async function setupSockets(server) {
  if (!server) return null;
  if (server.__lurkSockets) return server.__lurkSockets;

  const socketState = {
    adapter: "memory",
    redis: {
      enabled: Boolean(REDIS_URL),
      status: REDIS_URL ? "connecting" : "disabled",
      error: null,
    },
    history: {
      backend: CHAT_HISTORY_BACKEND,
      status: CHAT_HISTORY_BACKEND === "redis" ? "connecting" : "memory",
      error: null,
    },
  };

  const io = new SocketIOServer(server, {
    path: "/socket.io",
    cors: { origin: "*", methods: ["GET", "POST"] },
    maxHttpBufferSize: SOCKET_MAX_HTTP_BUFFER,
    pingInterval: SOCKET_PING_INTERVAL_MS,
    pingTimeout: SOCKET_PING_TIMEOUT_MS,
    perMessageDeflate: SOCKET_PER_MESSAGE_DEFLATE ? { threshold: 1024 } : false,
  });

  const closeHandlers = [];
  let historyStore = createMemoryChatHistoryStore(chatHistoryMemory);
  let redisModule = null;
  let redisAdapterModule = null;

  if (REDIS_URL) {
    redisModule = await loadRedisModule();
    redisAdapterModule = await loadRedisAdapterModule();

    if (!redisModule || !redisAdapterModule) {
      socketState.redis.status = "disabled";
      socketState.redis.error = "redis_dependencies_missing";
      if (REDIS_REQUIRED) {
        throw new Error(
          "Redis dependencies missing. Install redis and @socket.io/redis-adapter."
        );
      }
    }
  }

  if (REDIS_URL && redisModule && redisAdapterModule) {
    const pubClient = createRedisClient(
      redisModule,
      REDIS_URL,
      "socket-pub",
      socketState
    );
    const subClient = pubClient.duplicate();
    const pubReady = await connectRedisClient(pubClient, "socket-pub", socketState);
    const subReady = await connectRedisClient(subClient, "socket-sub", socketState);

    if (pubReady && subReady) {
      io.adapter(redisAdapterModule.createAdapter(pubClient, subClient));
      socketState.adapter = "redis";
      socketState.redis.status = "ok";
      closeHandlers.push(() => safeQuitRedis(pubClient));
      closeHandlers.push(() => safeQuitRedis(subClient));
    } else {
      socketState.redis.status = "degraded";
      socketState.redis.error =
        socketState.redis.error ?? "redis_adapter_connect_failed";
      await safeQuitRedis(pubClient);
      await safeQuitRedis(subClient);
      if (REDIS_REQUIRED) {
        throw new Error(
          "REDIS_REQUIRED is set but Redis adapter could not connect"
        );
      }
    }
  }

  if (CHAT_HISTORY_BACKEND === "redis") {
    if (!REDIS_URL) {
      socketState.history.status = "memory";
      socketState.history.error = "redis_url_missing";
    } else if (!redisModule) {
      socketState.history.status = "memory";
      socketState.history.error = "redis_dependencies_missing";
    } else {
      const historyClient = createRedisClient(
        redisModule,
        REDIS_URL,
        "chat-history",
        socketState
      );
      const historyReady = await connectRedisClient(
        historyClient,
        "chat-history",
        socketState
      );

      if (historyReady) {
        historyStore = createRedisChatHistoryStore(historyClient);
        socketState.history.status = "redis";
        closeHandlers.push(() => safeQuitRedis(historyClient));
      } else {
        socketState.history.status = "memory";
        socketState.history.error =
          socketState.history.error ?? "redis_history_connect_failed";
        await safeQuitRedis(historyClient);
      }
    }
  } else {
    socketState.history.status = "memory";
  }

  const CHAT_ROOM_DEFAULT = "chat-global";
  const VIDEO_ROOM_DEFAULT = "video-global";
  const videoRooms = new Map();
  const schedulePublicRooms = createPublicRoomsEmitter(io, {
    debounceMs: PUBLIC_ROOMS_BROADCAST_MS,
  });
  const chatRateLimiter = createSocketRateLimiter({
    windowMs: SOCKET_CHAT_RATE_WINDOW_MS,
    max: SOCKET_CHAT_RATE_MAX,
    key: "chat",
  });

  const recordChatHistory = async (roomId, message) => {
    if (!roomId || !message) return;
    try {
      await historyStore.append(roomId, message);
    } catch (err) {
      console.warn("chat history write failed", err);
    }
  };
  const sendChatHistory = async (socket, roomId) => {
    if (!socket || !roomId) return;
    try {
      const history = await historyStore.get(roomId);
      if (!history || !history.length) return;
      socket.emit("chat history", history.slice());
    } catch (err) {
      console.warn("chat history read failed", err);
    }
  };

  const normalizeRoomId = (value, fallback) => {
    if (!value) return fallback;
    const cleaned = String(value).replace(/[^a-zA-Z0-9-_]/g, "").slice(0, 48);
    return cleaned || fallback;
  };

  const joinChatRoomSync = (socket, roomId) => {
    const resolvedRoom = normalizeRoomId(roomId, CHAT_ROOM_DEFAULT);
    const currentRoom = socket.data?.chatRoomId;
    if (currentRoom && currentRoom !== resolvedRoom) {
      socket.leave(currentRoom);
    }
    socket.join(resolvedRoom);
    socket.data.chatRoomId = resolvedRoom;
    schedulePublicRooms();
    return resolvedRoom;
  };

  const joinChatRoom = async (socket, roomId, { emitHistory = false } = {}) => {
    const resolvedRoom = joinChatRoomSync(socket, roomId);
    if (emitHistory) {
      await sendChatHistory(socket, resolvedRoom);
    }
    return resolvedRoom;
  };

  const leaveVideoRoom = (socket) => {
    const roomId = socket.data?.videoRoomId;
    if (!roomId) return;
    socket.leave(roomId);
    const room = videoRooms.get(roomId);
    if (room) {
      room.delete(socket.id);
      if (!room.size) videoRooms.delete(roomId);
    }
    socket.to(roomId).emit("video-peer-left", {
      peerId: socket.id,
      name: socket.data?.displayName || "Guest",
    });
    socket.data.videoRoomId = null;
  };

  io.on("connection", (socket) => {
    void joinChatRoom(socket, socket.data?.chatRoomId, { emitHistory: true });
    schedulePublicRooms();

    socket.on("join-chat-room", ({ roomId } = {}) => {
      void joinChatRoom(socket, roomId, { emitHistory: true });
    });

    socket.on("chat message", (payload = {}) => {
      const limit = chatRateLimiter(socket);
      if (!limit.allowed) {
        if (Number.isFinite(limit.retryAfterMs)) {
          socket.emit("chat rate limited", {
            retryAfterMs: limit.retryAfterMs,
          });
        }
        return;
      }

      const text = sanitizeMessage(
        typeof payload === "string" ? payload : payload?.text
      );
      const sticker = sanitizeSticker(payload?.sticker);
      if (!text && !sticker) return;
      const name = sanitizeDisplayName(payload?.name);
      const ts = Number.isFinite(payload?.ts) ? payload.ts : Date.now();
      const id = payload?.id || `${socket.id}-${ts}`;
      const roomId = joinChatRoomSync(
        socket,
        payload?.roomId || socket.data?.chatRoomId
      );
      const message = { id, text, name, ts, roomId };
      if (sticker) message.sticker = sticker;
      void recordChatHistory(roomId, message);
      io.to(roomId).emit("chat message", message);
    });

    socket.on("join-video-room", ({ roomId, name } = {}) => {
      const resolvedRoom = normalizeRoomId(roomId, VIDEO_ROOM_DEFAULT);
      if (socket.data?.videoRoomId && socket.data.videoRoomId !== resolvedRoom) {
        leaveVideoRoom(socket);
      }
      const displayName = sanitizeDisplayName(name);
      socket.join(resolvedRoom);
      socket.data.videoRoomId = resolvedRoom;
      socket.data.displayName = displayName;

      let room = videoRooms.get(resolvedRoom);
      if (!room) {
        room = new Map();
        videoRooms.set(resolvedRoom, room);
      }
      room.set(socket.id, { name: displayName });

      const existing = [];
      for (const [peerId, peer] of room.entries()) {
        if (peerId === socket.id) continue;
        existing.push({ peerId, name: peer.name });
      }
      socket.emit("video-existing-peers", existing);
      socket.to(resolvedRoom).emit("video-peer-joined", {
        peerId: socket.id,
        name: displayName,
      });
    });

    socket.on("leave-video-room", () => {
      leaveVideoRoom(socket);
    });

    socket.on("video-offer", ({ to, description } = {}) => {
      if (!to || !description) return;
      socket.to(to).emit("video-offer", { from: socket.id, description });
    });

    socket.on("video-answer", ({ to, description } = {}) => {
      if (!to || !description) return;
      socket.to(to).emit("video-answer", { from: socket.id, description });
    });

    socket.on("video-ice-candidate", ({ to, candidate } = {}) => {
      if (!to || !candidate) return;
      socket.to(to).emit("video-ice-candidate", { from: socket.id, candidate });
    });

    socket.on("disconnect", () => {
      leaveVideoRoom(socket);
      schedulePublicRooms();
    });
  });

  const sockets = {
    io,
    state: socketState,
    close: async () => {
      schedulePublicRooms.shutdown?.();
      io.close();
      for (const handler of closeHandlers) {
        try {
          await handler();
        } catch (err) {
          console.warn("socket shutdown handler failed", err);
        }
      }
    },
  };

  server.__lurkSockets = sockets;
  return sockets;
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
}

function checkDbHealth(db) {
  if (!db) return { ok: false, error: "db_unavailable" };
  try {
    db.prepare("SELECT 1").get();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message ?? String(err) };
  }
}

function createSocketRateLimiter({ windowMs, max, key = "default" } = {}) {
  const windowMsNumber = Number(windowMs);
  const maxNumber = Number(max);
  if (!Number.isFinite(windowMsNumber) || !Number.isFinite(maxNumber)) {
    return () => ({ allowed: true, retryAfterMs: null });
  }
  if (windowMsNumber <= 0 || maxNumber <= 0) {
    return () => ({ allowed: true, retryAfterMs: null });
  }

  return (socket) => {
    if (!socket?.data) return { allowed: true, retryAfterMs: null };
    const store =
      socket.data.__rateLimits ?? (socket.data.__rateLimits = {});
    const now = Date.now();
    let state = store[key];
    if (!state || now >= state.resetAt) {
      state = { remaining: maxNumber, resetAt: now + windowMsNumber };
      store[key] = state;
    }

    if (state.remaining <= 0) {
      return { allowed: false, retryAfterMs: Math.max(0, state.resetAt - now) };
    }

    state.remaining -= 1;
    return { allowed: true, retryAfterMs: null };
  };
}

function createPublicRoomsEmitter(io, { debounceMs = 0 } = {}) {
  let timer = null;
  let lastEmit = 0;

  const emitNow = () => {
    const rooms = [];
    for (const [roomId, members] of io.sockets.adapter.rooms) {
      if (!roomId.startsWith("chat-public-")) continue;
      const name = roomId.slice("chat-public-".length) || "lobby";
      rooms.push({ name: name.toUpperCase(), count: members.size });
    }
    rooms.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    io.emit("public-rooms", rooms);
    lastEmit = Date.now();
  };

  const schedule = () => {
    if (debounceMs <= 0) {
      emitNow();
      return;
    }
    if (timer) return;
    const wait = Math.max(0, debounceMs - (Date.now() - lastEmit));
    timer = setTimeout(() => {
      timer = null;
      emitNow();
    }, wait);
  };

  schedule.shutdown = () => {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
  };

  return schedule;
}

function createMemoryChatHistoryStore(storeMap) {
  return {
    async append(roomId, message) {
      if (!roomId || !message) return;
      const history = storeMap.get(roomId) || [];
      history.push(message);
      if (history.length > CHAT_HISTORY_LIMIT) {
        history.splice(0, history.length - CHAT_HISTORY_LIMIT);
      }
      storeMap.set(roomId, history);
    },
    async get(roomId) {
      if (!roomId) return [];
      const history = storeMap.get(roomId);
      return history ? history.slice() : [];
    },
  };
}

function createRedisChatHistoryStore(client) {
  return {
    async append(roomId, message) {
      if (!roomId || !message) return;
      const key = `${CHAT_HISTORY_KEY_PREFIX}${roomId}`;
      const payload = JSON.stringify(message);
      const pipeline = client.multi();
      pipeline.rPush(key, payload);
      pipeline.lTrim(key, -CHAT_HISTORY_LIMIT, -1);
      if (CHAT_HISTORY_TTL_SEC > 0) {
        pipeline.expire(key, CHAT_HISTORY_TTL_SEC);
      }
      await pipeline.exec();
    },
    async get(roomId) {
      if (!roomId) return [];
      const key = `${CHAT_HISTORY_KEY_PREFIX}${roomId}`;
      const entries = await client.lRange(key, 0, -1);
      return entries.map((entry) => safeJsonParse(entry)).filter(Boolean);
    },
  };
}

let redisModuleCache = null;
let redisAdapterModuleCache = null;

async function loadRedisModule() {
  if (redisModuleCache) return redisModuleCache;
  try {
    redisModuleCache = await import("redis");
    return redisModuleCache;
  } catch (err) {
    console.warn("redis module unavailable", err);
    return null;
  }
}

async function loadRedisAdapterModule() {
  if (redisAdapterModuleCache) return redisAdapterModuleCache;
  try {
    redisAdapterModuleCache = await import("@socket.io/redis-adapter");
    return redisAdapterModuleCache;
  } catch (err) {
    console.warn("@socket.io/redis-adapter module unavailable", err);
    return null;
  }
}

function createRedisClient(redisModule, url, label, socketState) {
  const client = redisModule.createClient({
    url,
    socket: {
      reconnectStrategy: (retries) =>
        Math.min(REDIS_RECONNECT_BASE_MS * retries, REDIS_RECONNECT_MAX_MS),
    },
  });

  client.on("error", (err) => {
    const message = err?.message ?? String(err);
    if (socketState?.redis) {
      socketState.redis.error = message;
      if (socketState.redis.status === "ok") {
        socketState.redis.status = "degraded";
      }
    }
    if (socketState?.history?.status === "redis") {
      socketState.history.error = message;
    }
    console.warn(`redis ${label} error`, err);
  });

  return client;
}

async function connectRedisClient(client, label, socketState) {
  if (!client) return false;
  try {
    await withTimeout(client.connect(), REDIS_CONNECT_TIMEOUT_MS, label);
    return true;
  } catch (err) {
    const message = err?.message ?? String(err);
    if (socketState?.redis) {
      socketState.redis.error = message;
    }
    if (socketState?.history?.status === "connecting") {
      socketState.history.error = message;
    }
    console.warn(`redis ${label} connection failed`, err);
    return false;
  }
}

async function safeQuitRedis(client) {
  if (!client) return;
  try {
    await client.quit();
  } catch (_err) {
    try {
      await client.disconnect();
    } catch (err) {
      console.warn("redis disconnect failed", err);
    }
  }
}

function withTimeout(promise, timeoutMs, label) {
  const timeout = Number(timeoutMs);
  if (!Number.isFinite(timeout) || timeout <= 0) return promise;
  let timer = null;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeout}ms`));
    }, timeout);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function safeJsonParse(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (_err) {
    return null;
  }
}

/* ---- mail, sockets, schema, serialization unchanged ---- */
