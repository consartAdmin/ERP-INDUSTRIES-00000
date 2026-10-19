// ╔══════════════════════════════════════════════════════════════════════╗
// ║ dreGerencialRoutes.js — Rotas DRE Gerencial                         ║
// ║ CONSART ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';

import {
  resumo,
  listDespesas,
  createDespesa,
  updateDespesa,
  deleteDespesa,
  gerarPdfDre,
} from '../controllers/dreGerencialController.js';

const router = Router();

// 📊 Resumo DRE do mês
// GET /api/dre-gerencial/resumo?month=2026-05
router.get('/resumo', resumo);

// 💸 Despesas do mês
// GET /api/dre-gerencial/despesas?month=2026-05
router.get('/despesas', listDespesas);

// ➕ Criar despesa
// POST /api/dre-gerencial/despesas
router.post('/despesas', createDespesa);

router.get('/pdf', gerarPdfDre);

// ✏️ Atualizar despesa
// PUT /api/dre-gerencial/despesas/:id
router.put('/despesas/:id', updateDespesa);

// 🗑️ Excluir despesa
// DELETE /api/dre-gerencial/despesas/:id
router.delete('/despesas/:id', deleteDespesa);

export default router;