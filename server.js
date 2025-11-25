import express from "express";
import http from "http";
import next from "next";
import { attachApiLayer } from "./api/server.js";

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

try {
  app
    .prepare()
    .then(() => {
      const expressApp = express();
      const server = http.createServer(expressApp);

      attachApiLayer({ app: expressApp, server, dev });

      expressApp.all(/.*/, (req, res) => {
        try {
          return handle(req, res);
        } catch (err) {
          console.error("⚠️ Route handling error:", err);
          res.status(500).send("Server error");
        }
      });

      const PORT = process.env.PORT || 8080;
      server.listen(PORT, "0.0.0.0", () => {
        console.log(`🚀 Lurk running on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error("⚠️ Next.js prepare() failed:", err);
      process.exit(1);
    });
} catch (err) {
  console.error("⚠️ Fatal startup error:", err);
  process.exit(1);
}
