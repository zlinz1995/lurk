import fs from "fs";
import path from "path";
import { Router } from "express";
import multer from "multer";
import * as mediaController from "../controllers/mediaController.js";

const DATA_DIR = process.env.DATA_DIR || "/tmp/lurk-data";
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({ dest: UPLOAD_DIR });

const router = Router();

router.post("/upload", upload.single("file"), mediaController.uploadFile);

export default router;
