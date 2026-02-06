import fs from "fs";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

export function loadEnv() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // env.js -> src/config -> src -> lurk-backend
  const backendRoot = path.resolve(__dirname, "..", "..");
  const candidates = [
    path.join(backendRoot, ".env"),
    path.join(backendRoot, "..", ".env"),
  ];

  let loadedPath = "";
  for (const envPath of candidates) {
    if (!fs.existsSync(envPath)) continue;
    dotenv.config({ path: envPath, override: true });
    loadedPath = envPath;
    break;
  }

  if (loadedPath) {
    console.log("[env] loaded from:", loadedPath);
  } else {
    console.warn("[env] no .env file found in expected locations");
  }
}

export default loadEnv;
