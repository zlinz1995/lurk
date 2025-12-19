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

const MOD_ALERT_EMAIL = process.env.MOD_ALERT_EMAIL ?? "z.linz@outlook.com";
const DEFAULT_FROM_EMAIL =
  process.env.SMTP_FROM ?? process.env.SMTP_USER ?? MOD_ALERT_EMAIL;

const ALLOWED_MEDIA_PREFIXES = ["image/", "video/", "audio/"];
const reactMemory = new Map();

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

export function attachApiLayer({ app, server, dev = false } = {}) {
  if (!app || !server) {
    throw new Error("attachApiLayer requires app and server");
  }

  ensureDirectories();
  resetDatabase();

  const db = new Database(DB_PATH);
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

  app.get("/health", (_req, res) => res.json({ ok: true }));

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

  setupSockets(server);
  return { db };
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

/* ---- mail, sockets, schema, serialization unchanged ---- */
