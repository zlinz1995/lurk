import http from "http";
import express from "express";
import { loadEnv } from "./config/env.js";
import { attachApiLayer } from "./lurkApi.js";

loadEnv();

const PORT = process.env.PORT || process.env.API_PORT || 4000;
const dev = process.env.NODE_ENV !== "production";

const app = express();
const server = http.createServer(app);

try {
  attachApiLayer({ app, server, dev });
  console.log("attachApiLayer completed successfully");
} catch (err) {
  console.error("attachApiLayer failed:", err);
}

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Lurk API listening on port ${PORT}`);
});
