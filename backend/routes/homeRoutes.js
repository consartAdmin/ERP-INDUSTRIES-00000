// backend/routes/homeRoutes.js
import { Router } from "express";
import homeController from "../controllers/homeController.js";

const router = Router();

// ✅ Rota para acessar a home
router.get("/", homeController.renderHome);

export default router;
