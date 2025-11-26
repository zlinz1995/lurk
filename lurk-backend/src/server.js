import http from "http";
import express from "express";
import { loadEnv } from "./config/env.js";
import { attachApiLayer } from "./lurkApi.js";

loadEnv();

const PORT = process.env.PORT || process.env.API_PORT || 4000;
const dev = process.env.NODE_ENV !== "production";

const app = express();
const server = http.createServer(app);

attachApiLayer({ app, server, dev });

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Lurk API listening on port ${PORT}`);
});
