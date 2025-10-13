import express from "express";
import fs from "fs";
import path from "path";
import http from "http";
import https from "https";
import { fileURLToPath } from "url";
import multer from "multer";
import { Server } from "socket.io";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

// --- SSL setup (development only) ---
// In production (e.g., Render), TLS terminates at the edge and the app
// should listen over plain HTTP on PORT. For local dev, if certs exist,
// use HTTPS; otherwise fall back to HTTP.
let credentials = null;
try {
  const key = fs.readFileSync(path.join(__dirname, "certs", "localhost-key.pem"));
  const cert = fs.readFileSync(path.join(__dirname, "certs", "localhost.pem"));
  credentials = { key, cert };
} catch {}

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static folders
app.use("/", express.static(path.join(__dirname, "public")));

// --- Security headers (fixed CSP) ---
app.use((req, res, next) => {
  // Allow inline scripts during development
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https://cdn.socket.io"
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

// --- Uploads directory (configurable) ---
// Default to local "uploads" for dev; allow override via env for prod/disks.
const uploadDir = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, "uploads");
try {
  fs.mkdirSync(uploadDir, { recursive: true });
} catch {}
app.use("/uploads", express.static(uploadDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) =>
    cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, "_")}`),
});
const upload = multer({ storage });

// --- In-memory thread storage (auto-clears on restart) ---
let threads = [];

// --- Routes ---
// Get all threads
app.get("/threads", (req, res) => {
  res.json(threads);
});

// Create a new thread
app.post("/threads", upload.single("image"), (req, res) => {
  const { title, body } = req.body;
  const sensitive = (() => {
    const v = (req.body?.sensitive ?? "").toString().toLowerCase();
    return v === "on" || v === "true" || v === "1";
  })();
  const newThread = {
    id: Date.now(),
    title: title || "Untitled",
    body: body || "",
    image: req.file ? `/uploads/${req.file.filename}` : null,
    sensitive,
    timestamp: new Date().toISOString(),
    replies: [],
    reactions: { "👍": 0, "❤️": 0, "😂": 0, "😮": 0, "🔥": 0 },
  };
  threads.unshift(newThread);
  res.json(newThread);
});

// Add a reply to a thread
app.post("/threads/:id/replies", (req, res) => {
  const id = Number(req.params.id);
  const thread = threads.find((t) => t.id === id);
  if (!thread) return res.status(404).json({ error: "Thread not found" });

  const text = (req.body?.text || "").toString().slice(0, 2000);
  if (!text.trim()) return res.status(400).json({ error: "Empty reply" });

  const reply = {
    id: Date.now(),
    text,
    timestamp: new Date().toISOString(),
  };
  if (!Array.isArray(thread.replies)) thread.replies = [];
  thread.replies.push(reply);
  res.json(reply);
});

// React to a thread (emoji pulse)
app.post("/threads/:id/react", (req, res) => {
  const id = Number(req.params.id);
  const thread = threads.find((t) => t.id === id);
  if (!thread) return res.status(404).json({ error: "Thread not found" });

  const allowed = ["👍", "❤️", "😂", "😮", "🔥"];
  const emoji = (req.body?.emoji || "").toString();
  if (!allowed.includes(emoji)) return res.status(400).json({ error: "Invalid emoji" });

  if (!thread.reactions) thread.reactions = Object.fromEntries(allowed.map((e) => [e, 0]));
  thread.reactions[emoji] = (thread.reactions[emoji] || 0) + 1;
  res.json({ reactions: thread.reactions });
});

// --- Auto-purge old threads (hourly) ---
setInterval(() => {
  console.log("[Lurk] Purging old threads and uploads...");
  threads = [];
  fs.readdir(uploadDir, (err, files) => {
    if (err) return;
    for (const file of files) {
      fs.unlink(path.join(uploadDir, file), () => {});
    }
  });
}, 60 * 60 * 1000); // every hour

// --- Error handler ---
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// --- Health check (used by Render) ---
app.get("/healthz", (req, res) => res.status(200).send("ok"));

// --- Create HTTP(S) server ---
// Use plain HTTP in production (Render terminates TLS). In dev, prefer HTTPS
// if certs were found, otherwise HTTP.
const useHttps = process.env.NODE_ENV !== "production" && credentials;
const server = useHttps ? https.createServer(credentials, app) : http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  path: "/socket.io",
});

// --- Socket.IO Chat ---
io.on("connection", (socket) => {
  // Use a generic display name for connections and chat notices
  const user = "Anonymous";
  console.log(`[Lurk] ${user} connected`);
  socket.emit("chat message", `Welcome, ${user}!`);
  socket.broadcast.emit("chat message", `${user} joined`);

  socket.on("chat message", (msg) => {
    io.emit("chat message", msg);
  });

  socket.on("disconnect", () => {
    io.emit("chat message", `${user} left`);
  });
});

// --- Start Server ---
const PORT = process.env.PORT || 8080;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Lurk running on port ${PORT}`);
  console.log(`📱 Or on LAN: https://<your-local-IP>:${PORT}`);
});
