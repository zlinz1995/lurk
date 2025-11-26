import fs from "fs";
import path from "path";
import http from "http";
import express from "express";
import { loadEnv } from "./config/env.js";
import { attachApiLayer } from "./lurkApi.js";

loadEnv();

const PORT = process.env.PORT || process.env.API_PORT || 4000;
const dev = process.env.NODE_ENV !== "production";
const ROOT_DIR = process.cwd();
const STATIC_DIR = path.join(ROOT_DIR, "out");

const app = express();
const server = http.createServer(app);

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

try {
  attachApiLayer({ app, server, dev });
  console.log("attachApiLayer completed successfully");
} catch (err) {
  console.error("attachApiLayer failed:", err);
}

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Lurk API listening on port ${PORT}`);
});
