import fs from "fs";
import path from "path";
import http from "http";
import express from "express";
import { createRequire } from "module";
import { loadEnv } from "./config/env.js";

loadEnv();

console.log("GOOGLE ENV CHECK", {
  id: process.env.GOOGLE_CLIENT_ID,
  secret: process.env.GOOGLE_CLIENT_SECRET,
  redirect: process.env.GOOGLE_REDIRECT_URI,
});

const [{ attachApiLayer }, { default: quantumRoutes }] = await Promise.all([
  import("./lurkApi.js"),
  import("./routes/quantum.js"),
]);

const PORT = process.env.PORT || process.env.API_PORT || 4000;
const dev = process.env.NODE_ENV !== "production";
const ROOT_DIR = process.cwd();
const STATIC_DIR = path.join(ROOT_DIR, "out");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const KEEP_ALIVE_TIMEOUT_MS = Number(
  process.env.SERVER_KEEP_ALIVE_TIMEOUT_MS ?? 65_000
);
const HEADERS_TIMEOUT_MS = Number(
  process.env.SERVER_HEADERS_TIMEOUT_MS ?? 70_000
);
const SHUTDOWN_TIMEOUT_MS = Number(process.env.SHUTDOWN_TIMEOUT_MS ?? 10_000);
const require = createRequire(import.meta.url);

const app = express();
const server = http.createServer(app);

if (Number.isFinite(KEEP_ALIVE_TIMEOUT_MS)) {
  server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT_MS;
}
if (Number.isFinite(HEADERS_TIMEOUT_MS)) {
  server.headersTimeout = Math.max(
    HEADERS_TIMEOUT_MS,
    server.keepAliveTimeout + 1000
  );
}

app.use("/api/quantum", quantumRoutes);

// Serve a guaranteed socket.io client build (safety net if the default handler is blocked)
app.get("/socket.io/socket.io.js", (_req, res, next) => {
  try {
    const clientPath = require.resolve("socket.io-client/dist/socket.io.min.js");
    res.sendFile(clientPath);
  } catch (err) {
    next(err);
  }
});

app.get("/main.js", (_req, res, next) => {
  const mainPath = path.join(PUBLIC_DIR, "main.js");
  if (!fs.existsSync(mainPath)) return next();
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(mainPath);
});

if (fs.existsSync(STATIC_DIR)) {
  app.use(express.static(STATIC_DIR));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/socket.io")) return next();
    if (path.extname(req.path)) return next();
    const normalized = req.path === "/" ? "/index" : req.path.replace(/\/$/, "");
    const candidate = path.join(STATIC_DIR, `${normalized}.html`);
    if (fs.existsSync(candidate)) {
      res.sendFile(candidate);
      return;
    }
    next();
  });
} else {
  console.warn(`Static export directory not found at ${STATIC_DIR}`);
}

let api = null;
try {
  api = await attachApiLayer({ app, server, dev });
  console.log("attachApiLayer completed successfully");
} catch (err) {
  console.error("attachApiLayer failed:", err);
  process.exit(1);
}

const shutdown = createShutdown({ server, api, timeoutMs: SHUTDOWN_TIMEOUT_MS });
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("uncaughtException", (err) => {
  console.error("uncaughtException", err);
  shutdown("uncaughtException");
});
process.on("unhandledRejection", (err) => {
  console.error("unhandledRejection", err);
  shutdown("unhandledRejection");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Lurk API listening on port ${PORT}`);
});

function createShutdown({ server, api, timeoutMs }) {
  let shuttingDown = false;
  return async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Shutting down (${signal})...`);
    const fatalSignals = new Set(["uncaughtException", "unhandledRejection"]);
    const exitCode = fatalSignals.has(signal) ? 1 : 0;

    const forceTimer = setTimeout(() => {
      console.error("Forced shutdown");
      process.exit(1);
    }, timeoutMs);
    forceTimer.unref?.();

    try {
      if (api?.sockets?.close) {
        await api.sockets.close();
      }
      if (api?.db?.close) {
        api.db.close();
      }
      await new Promise((resolve) => server.close(resolve));
    } catch (err) {
      console.error("Shutdown error", err);
    } finally {
      clearTimeout(forceTimer);
      process.exit(exitCode);
    }
  };
}
