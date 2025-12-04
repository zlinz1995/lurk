import { Router } from "express";
import { spawn } from "child_process";
import path from "path";

const router = Router();

router.get("/random-bit", (req, res) => {
    const scriptPath = path.join(process.cwd(), "quantum_worker", "main.py");

    const python = spawn("python", [scriptPath]);

    let output = "";
    python.stdout.on("data", (data) => {
        output += data.toString();
    });

    python.stderr.on("data", (data) => {
        console.error("Quantum Worker Error:", data.toString());
    });

    python.on("close", () => {
        try {
            // Expect line like: Random quantum bit: {'0': 493, '1': 507}
            const match = output.match(/\{.*\}/);
            const result = match ? match[0] : "{}";
            res.json({ result });
        } catch (err) {
            res.status(500).json({ error: "Failed to parse quantum output" });
        }
    });
});

export default router;
