// ╔══════════════════════════════════════════════════════════════════╗
// ║ loginRoutes.js — Rota de autenticação JWT (/api/login)           ║
// ║ Padrão ESM (import/export)                                       ║
// ╚══════════════════════════════════════════════════════════════════╝

import { Router } from "express";
import { login } from "../controllers/loginController.js";

const router = Router();

// 🎯 POST /api/login
router.post("/login", async (req, res) => {
  console.log("\n[LOGIN ROUTE] 🔐 POST /api/login");
  try {
    await login(req, res);
  } catch (err) {
    console.error("[LOGIN ROUTE] 💥 Erro inesperado:", err);
    res.status(500).json({
      erro: "Erro inesperado ao processar o login.",
      detalhe: err.message,
    });
  }
});

export default router;
