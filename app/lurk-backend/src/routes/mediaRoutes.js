import { Router } from "express";
import multer from "multer";
import * as mediaController from "../controllers/mediaController.js";

const upload = multer({ dest: "uploads/" });

const router = Router();

router.post("/upload", upload.single("file"), mediaController.uploadFile);

export default router;
