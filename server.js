import express from "express";
import fs from "fs";
import path from "path";
import http from "http";
import https from "https";
import { fileURLToPath } from "url";
import multer from "multer";
import next from "next";
import { Server } from "socket.io";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.set("trust proxy", true);

// --- SSL setup (dev only) ---
let credentials = null;
try {
  const key = fs.readFileSync(path.join(__dirname, "certs", "localhost-key.pem"));
  const cert = fs.readFileSync(path.join(__dirname, "certs", "localhost.pem"));
  credentials = { key, cert };
} catch {}

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Do not mount public/ at "/" here — Next serves from its own public/.

// Security headers
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https://cdn.socket.io"
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

// --- Uploads directory ---
const uploadDir = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, "uploads");
try { fs.mkdirSync(uploadDir, { recursive: true }); } catch {}
app.use("/uploads", express.static(uploadDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, "_")}`),
});
const upload = multer({ storage });

// --- Data store (in-memory) ---
let threads = [];

// --- Rate limiter (per IP) ---
const rateBuckets = new Map();
function getIp(req) {
  const xf = (req.headers["x-forwarded-for"] || "").toString();
  if (xf) return xf.split(",")[0].trim();
  return req.ip || req.connection?.remoteAddress || "unknown";
}
function rateLimit({ key, windowMs, limit, blockMs = 15000 }) {
  return (req, res, next) => {
    try {
      const ip = getIp(req);
      const k = `${key}|${ip}`;
      const now = Date.now();
      let b = rateBuckets.get(k);
      if (!b) { b = { count: 0, resetAt: now + windowMs, blockedUntil: 0 }; rateBuckets.set(k, b); }
      if (b.blockedUntil && now < b.blockedUntil) {
        res.setHeader("Retry-After", String(Math.ceil((b.blockedUntil - now) / 1000)));
        return res.status(429).json({ error: "Rate limit exceeded" });
      }
      if (now > b.resetAt) { b.count = 0; b.resetAt = now + windowMs; }
      b.count += 1;
      res.setHeader("X-RateLimit-Limit", String(limit));
      res.setHeader("X-RateLimit-Remaining", String(Math.max(0, limit - b.count)));
      if (b.count > limit) { b.blockedUntil = now + blockMs; return res.status(429).json({ error: "Rate limit exceeded" }); }
      next();
    } catch { next(); }
  };
}
const limitCreateThread = rateLimit({ key: "thread:create", windowMs: 60_000, limit: 5, blockMs: 60_000 });
const limitAddReply    = rateLimit({ key: "reply:add",   windowMs: 60_000, limit: 20, blockMs: 45_000 });
const limitReact       = rateLimit({ key: "react:add",   windowMs: 60_000, limit: 60, blockMs: 30_000 });
const limitReport      = rateLimit({ key: "report:add",  windowMs: 60_000, limit: 10, blockMs: 60_000 });

// Next top-of-hour timestamp (ms) for countdown
function nextHourTs() {
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  return Math.floor(now / hour) * hour + hour;
}

// --- Routes ---
app.get("/threads", (req, res) => {
  res.json(threads);
});

// Legacy static paths -> Next routes
app.get(["/index.html"], (req, res) => res.redirect(301, "/"));
app.get(["/blog.html"], (req, res) => res.redirect(301, "/blog"));
app.get(["/news.html"], (req, res) => res.redirect(301, "/news"));
app.get(["/faq.html"], (req, res) => res.redirect(301, "/faq"));
app.get(["/rules.html"], (req, res) => res.redirect(301, "/rules"));

app.post("/threads", limitCreateThread, upload.single("image"), (req, res) => {
  const { title, body } = req.body;
  const sensitive = (() => {
    const v = (req.body?.sensitive ?? "").toString().toLowerCase();
    return v === "on" || v === "true" || v === "1";
  })();
  const allowed = ["dY`?", "�?\u000f�,?", "dY~,", "dY~r", "dY\"�"];
  const reactions = Object.fromEntries(allowed.map((e) => [e, 0]));
  const newThread = {
    id: Date.now(),
    title: title || "Untitled",
    body: body || "",
    image: req.file ? `/uploads/${req.file.filename}` : null,
    sensitive,
    timestamp: new Date().toISOString(),
    expiry: nextHourTs(),
    replies: [],
    reactions,
  };
  threads.unshift(newThread);
  res.json(newThread);
  try { io.emit("thread:new", newThread); } catch {}
});

app.post("/threads/:id/replies", limitAddReply, (req, res) => {
  const id = Number(req.params.id);
  const thread = threads.find((t) => t.id === id);
  if (!thread) return res.status(404).json({ error: "Thread not found" });
  const text = (req.body?.text || "").toString().slice(0, 2000);
  if (!text.trim()) return res.status(400).json({ error: "Empty reply" });
  const reply = { id: Date.now(), text, timestamp: new Date().toISOString() };
  if (!Array.isArray(thread.replies)) thread.replies = [];
  thread.replies.push(reply);
  res.json(reply);
  try { io.emit("reply:new", { threadId: id, reply }); } catch {}
});

app.post("/threads/:id/react", limitReact, (req, res) => {
  const id = Number(req.params.id);
  const thread = threads.find((t) => t.id === id);
  if (!thread) return res.status(404).json({ error: "Thread not found" });
  const allowed = ["dY`?", "�?\u000f�,?", "dY~,", "dY~r", "dY\"�"];
  const emoji = (req.body?.emoji || "").toString();
  if (!allowed.includes(emoji)) return res.status(400).json({ error: "Invalid emoji" });
  if (!thread.reactions) thread.reactions = Object.fromEntries(allowed.map((e) => [e, 0]));
  thread.reactions[emoji] = (thread.reactions[emoji] || 0) + 1;
  res.json({ reactions: thread.reactions });
  try { io.emit("reaction:update", { threadId: id, reactions: thread.reactions }); } catch {}
});

// --- Anonymous abuse reports ---
const reportsDir = path.join(__dirname, "reports");
try { fs.mkdirSync(reportsDir, { recursive: true }); } catch {}
const reportsLog = path.join(reportsDir, "reports.log");

app.post("/reports", limitReport, (req, res) => {
  try {
    const { reason, details, threadId, replyId } = req.body || {};
    const allowed = ["abuse", "harassment", "spam", "nsfw", "illegal", "other"];
    const r = (reason || "other").toString().toLowerCase();
    const reasonValid = allowed.includes(r) ? r : "other";
    const text = (details || "").toString().slice(0, 2000);
    const report = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      reason: reasonValid,
      details: text,
      threadId: typeof threadId === 'string' || typeof threadId === 'number' ? Number(threadId) : null,
      replyId: typeof replyId === 'string' || typeof replyId === 'number' ? Number(replyId) : null,
      ua: (req.headers['user-agent'] || '').toString().slice(0, 300),
    };
    fs.appendFile(reportsLog, JSON.stringify(report) + "\n", () => {});
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: "Invalid report" });
  }
});

// --- Hourly purge ---
setInterval(() => {
  try { io.emit("threads:purged", { ids: threads.map(t => t.id), at: Date.now() }); } catch {}
  threads = [];
  fs.readdir(uploadDir, (err, files) => {
    if (err) return;
    for (const f of files) { fs.unlink(path.join(uploadDir, f), () => {}); }
  });
}, 60 * 60 * 1000);

// Error handler
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// Health check
app.get("/healthz", (req, res) => res.status(200).send("ok"));

// --- Next.js integration ---
const dev = process.env.NODE_ENV !== "production";
const nextApp = next({ dev, dir: path.join(__dirname) });
await nextApp.prepare();

// --- Server + Socket.IO ---
const useHttps = process.env.NODE_ENV !== "production" && credentials;
const server = useHttps ? https.createServer(credentials, app) : http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] }, path: "/socket.io" });

// Anonymous username pool
const NAME_PREFIX = "ghost";
const NAME_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const nameRegistry = new Map(); // name -> { inUse: boolean, reservedUntil: number }
const socketToName = new Map(); // socket.id -> name
function randomGhostName() {
  const suffix = Math.random().toString(36).slice(2, 10); // 8 chars
  return `${NAME_PREFIX}${suffix}`;
}
function assignName() {
  const now = Date.now();
  for (let i = 0; i < 50; i++) {
    const candidate = randomGhostName();
    const rec = nameRegistry.get(candidate);
    if (!rec || (!rec.inUse && now > rec.reservedUntil)) {
      nameRegistry.set(candidate, { inUse: true, reservedUntil: now + NAME_TTL_MS });
      return candidate;
    }
  }
  const fallback = `${NAME_PREFIX}${Date.now().toString(36).slice(-8)}`;
  nameRegistry.set(fallback, { inUse: true, reservedUntil: Date.now() + NAME_TTL_MS });
  return fallback;
}
setInterval(() => {
  const now = Date.now();
  for (const [name, rec] of nameRegistry) {
    if (!rec.inUse && now > rec.reservedUntil) nameRegistry.delete(name);
  }
}, 15 * 60 * 1000);

io.on("connection", (socket) => {
  const user = assignName();
  socketToName.set(socket.id, user);
  socket.emit("chat message", `Welcome, ${user}!`);
  socket.emit("chatMessage", { user: "system", time: new Date().toLocaleTimeString(), text: `You are ${user}` });
  socket.broadcast.emit("chat message", `${user} joined`);
  socket.broadcast.emit("chatMessage", { user: "system", time: new Date().toLocaleTimeString(), text: `${user} joined` });

  // Token bucket: 5 burst, refill 1/sec
  const bucket = { tokens: 5, last: Date.now() };
  const CAP = 5, REFILL = 1;
  const allow = () => {
    const now = Date.now();
    const delta = (now - bucket.last) / 1000;
    bucket.last = now;
    bucket.tokens = Math.min(CAP, bucket.tokens + delta * REFILL);
    if (bucket.tokens >= 1) { bucket.tokens -= 1; return true; }
    return false;
  };

  socket.on("chat message", (msg) => {
    if (!allow()) return socket.emit("chat message", "[system] Slow down: too many messages.");
    const text = String(msg || "").slice(0, 500);
    const payload = { user, text, time: new Date().toLocaleTimeString() };
    io.emit("chatMessage", payload);
    io.emit("chat message", `${user}: ${text}`);
    const rec = nameRegistry.get(user);
    if (rec) rec.reservedUntil = Date.now() + NAME_TTL_MS; // refresh TTL on activity
  });

  socket.on("disconnect", () => {
    io.emit("chat message", `${user} left`);
    io.emit("chatMessage", { user: "system", time: new Date().toLocaleTimeString(), text: `${user} left` });
    const rec = nameRegistry.get(user);
    if (rec) rec.inUse = false, rec.reservedUntil = Date.now() + NAME_TTL_MS;
    socketToName.delete(socket.id);
  });
});

const PORT = process.env.PORT || 8080;
// Let Next handle everything else after our API routes
const handle = nextApp.getRequestHandler();
app.all("*", (req, res) => handle(req, res));

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Lurk (Next.js) running on port ${PORT}`);
});
