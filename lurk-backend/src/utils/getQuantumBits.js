import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

// Support ES module path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default function getQuantumBits(n = 32) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, "getQuantumBits.py");

    const python = spawn("python", [scriptPath, String(n)]);

    let output = "";
    let errorOutput = "";

    python.stdout.on("data", (data) => {
      output += data.toString();
    });

    python.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    python.on("close", (code) => {
      if (code !== 0) {
        console.error("Quantum script error:", errorOutput);
        return reject(new Error("Quantum generator failed"));
      }
      resolve(output.trim());
    });
  });
}
