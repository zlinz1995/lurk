import { Router } from "express";
import auth from "../middleware/authMiddleware.js";
import * as reportController from "../controllers/reportController.js";

const router = Router();

router.post("/", auth, reportController.submitReport);

export default router;
