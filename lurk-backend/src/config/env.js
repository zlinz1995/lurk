import dotenv from "dotenv";
import path from "path";

export function loadEnv() {
  const rootDir = process.cwd();
  const envPath = path.join(rootDir, ".env");
  dotenv.config({ path: envPath });
}

export default loadEnv;
