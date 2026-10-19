// ╔══════════════════════════════════════════════════════════════════════╗
// ║ 📦 ordersKanbanRoutes.js – Rotas REST do Kanban de Pedidos (CONSART) ║
// ║ Base: /api/orders-kanban/...                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import express from 'express';
import {
  health,
  listarCards,
  criarCard,
  importarOrcamento,
  editarCard,
  finalizarCard,
  contarFinalizados,
  excluirCard,
  atualizarColunaCard,
  atualizarUrgente,
  listarStatus,
  listarColunasFiltro,
  buscarPendenciasPorCard,
  adicionarPendencia,
  concluirPendencia,
  reabrirPendencia,
  editarPendencia,
  gerarPdfTodasPendencias,
  excluirPendencia,
  contarPendencias,
  gerarPdfSeparacaoCard,
} from '../controllers/ordersKanbanController.js';

const router = express.Router();

// ---------------------------------------------------------------------
// 🩺 Health
// ---------------------------------------------------------------------
router.get('/health', health);
router.get('/ping', health);

// ---------------------------------------------------------------------
// 📊 Colunas / Status
// ---------------------------------------------------------------------
router.get('/columns', listarColunasFiltro);
router.get('/status', listarStatus);

// ---------------------------------------------------------------------
// 📦 Cards
// ---------------------------------------------------------------------
router.get('/cards', listarCards);
router.post('/cards', criarCard);
router.post('/cards/from-budget', importarOrcamento);

router.put('/cards/:id', editarCard);
router.patch('/cards/:id/move', atualizarColunaCard);
router.patch('/cards/:id/urgent', atualizarUrgente);
router.patch('/cards/:id/finish', finalizarCard);
router.delete('/cards/:id', excluirCard);

// Cards finalizados (não é pendência!)
router.get('/finished/count', contarFinalizados);

router.get('/cards/:id/separation-pdf', gerarPdfSeparacaoCard);

// ---------------------------------------------------------------------
// 📌 Pendências
// ---------------------------------------------------------------------
router.get('/cards/:id/pendings', buscarPendenciasPorCard);
router.post('/cards/:id/pendings', adicionarPendencia);

router.patch('/pendings/:id/complete', concluirPendencia);
router.patch('/pendings/:id/reopen', reabrirPendencia);
router.put('/pendings/:id', editarPendencia);
router.delete('/pendings/:id', excluirPendencia);

// Badge correto
router.get('/pendings/count', contarPendencias);

// ---------------------------------------------------------------------
// 🧾 PDF de Pendências
// ---------------------------------------------------------------------
router.get('/pendings/pdf', gerarPdfTodasPendencias);

export default router;
