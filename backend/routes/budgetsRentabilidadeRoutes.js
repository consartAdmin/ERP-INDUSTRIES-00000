// ╔══════════════════════════════════════════════════════╗
// ║ 📊 budgetsRentabilidadeRoutes.js (ESM)              ║
// ╚══════════════════════════════════════════════════════╝

import express from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { calcularRentabilidade } from '../controllers/budgetsRentabilidadeController.js';

const router = express.Router();

/*
 * ATENÇÃO: este router NÃO está montado no server.js — a rota é inalcançável.
 * O modal de rentabilidade do frontend calcula no cliente, a partir de
 * /api/products/cost-map e /api/barcodes/factors.
 * O requireAuth fica aqui para que a rota já nasça protegida se alguém a
 * montar no futuro. Candidato a remoção (verificado em 16/09/2026).
 */
router.get('/orcamentos/rentabilidade/:id', requireAuth, calcularRentabilidade);

export default router;
