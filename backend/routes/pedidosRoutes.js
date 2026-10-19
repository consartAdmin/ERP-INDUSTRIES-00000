// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 📡 pedidosRoutes.js – Rotas da API de Pedidos                            ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import * as ctrl from '../controllers/pedidosController.js';

const router = Router();

// ───────────────────────────────────────────────────────────────
// POST /api/pedidos/transformar/:id  → transformar orçamento → pedido
router.post('/transformar/:id(\\d+)', ctrl.transformarEmPedido);

// ───────────────────────────────────────────────────────────────
// GET /api/pedidos  → lista com filtros e paginação
router.get('/', ctrl.listarPedidos);

// ───────────────────────────────────────────────────────────────
// GET /api/pedidos/por-numero/:numero  → detalhes por número
router.get('/por-numero/:numero(\\d+)', ctrl.detalharPorNumero);

// ───────────────────────────────────────────────────────────────
// ✅ GET /api/pedidos/:id  → por id OU (?by=numero) por número
router.get('/:id(\\d+)', ctrl.obterPorIdOuNumero);

// ───────────────────────────────────────────────────────────────
// DELETE (HARD) /api/pedidos/:id/hard
router.options('/:id(\\d+)/hard', (_req, res) => res.sendStatus(204));
router.delete('/:id(\\d+)/hard', ctrl.excluirPedidoHard);

// ───────────────────────────────────────────────────────────────
// DELETE (SOFT) /api/pedidos/:id
router.options('/:id(\\d+)', (_req, res) => res.sendStatus(204));
router.delete('/:id(\\d+)', ctrl.excluirPedido);

// (Opcional) RESTORE do soft delete
router.patch('/:id(\\d+)/restore', ctrl.restaurarPedido);

export default router;
