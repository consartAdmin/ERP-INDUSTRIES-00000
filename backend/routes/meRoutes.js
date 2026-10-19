// ╔══════════════════════════════════════════════════════════════════════╗
// ║ backend/routes/meRoutes.js — Rotas “Me” (ESM) — CONSART ERP          ║
// ║ ✅ GET /api/me/seller (requerAuth)                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { getMySeller } from '../controllers/meController.js';
import { erpCompanyContext } from '../utils/erpCompanyContext.js';

const router = Router();

// Empresa da tela (BH3 x CONSART) também aqui, além do middleware global
router.use('/api/me', erpCompanyContext);

router.get('/api/me/seller', requireAuth, getMySeller);

export default router;