import { Router } from "express";
import auth from "../middleware/authMiddleware.js";
import * as postController from "../controllers/postController.js";

const router = Router();

router.post("/create", auth, postController.createPost);
router.get("/feed", postController.getFeed);

export default router;
