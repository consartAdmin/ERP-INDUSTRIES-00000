// ╔══════════════════════════════════════════════════════════════════════╗
// ║ backend/routes/caixaRoutes.js                                       ║
// ║ — Rotas Express do módulo Caixa                                     ║
// ║ CONSART ERP — ESM                                                   ║
// ║ ✅ Compatível com controller usando cashMovimentsApi.js             ║
// ║ ✅ Mantém endpoints antigos do frontend                             ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { Router } from 'express';

import {
  listMovimentacoes,
  getMovimentacao,
  createMovimentacao,
  updateMovimentacao,
  deleteMovimentacao,

  deleteMovimentacoesLote,
  updateMovimentacoesLote,

  listChartAccountsForCaixa,

  listCategorias,
  createCategoria,
  updateCategoriaCtrl,
  deleteCategoriaCtrl,

  // Subcategorias
  listSubcategorias,
  createSubcategoriaCtrl,
  updateSubcategoriaCtrl,
  deleteSubcategoriaCtrl,

  // Resumos / PDFs
  summary,
  saldos,
  relatorioPdf,

  // Status ativo/inativo + sub por categoria
  setCategoriaAtivaCtrl,
  setSubcategoriaAtivaCtrl,
  listSubcategoriasByCategoria,
} from '../controllers/cashMovimentsController.js';

import {
  listAnexosCaixa,
  countAnexosCaixa,
  deleteAnexoCaixa,
} from '../uploadBuckets/uploadBucketsCashMoviments.js';

import {
  headZipPeriodo,
  downloadZipPeriodo,
} from '../controllers/cashMovimentsZipController.js';

const router = Router();

/* ========================= MOVIMENTAÇÕES ============================ */

router.delete('/movimentacoes/lote', deleteMovimentacoesLote);
router.patch('/movimentacoes/lote', updateMovimentacoesLote);

router.get('/movimentacoes', listMovimentacoes);
router.get('/movimentacoes/:id', getMovimentacao);
router.post('/movimentacoes', createMovimentacao);
router.put('/movimentacoes/:id', updateMovimentacao);
router.delete('/movimentacoes/:id', deleteMovimentacao);

router.delete('/movimentos/lote', deleteMovimentacoesLote);

// Aliases para compatibilidade com o frontend antigo
router.get('/movimentos', listMovimentacoes);
router.get('/movimentos/:id', getMovimentacao);
router.post('/movimentos', createMovimentacao);
router.put('/movimentos/:id', updateMovimentacao);
router.delete('/movimentos/:id', deleteMovimentacao);

/* ========================= PLANO DE CONTAS =========================== */

router.get('/chart-accounts', listChartAccountsForCaixa);
router.get('/contas-contabeis', listChartAccountsForCaixa);

/* ========================= CATEGORIAS =============================== */

router.get('/categorias', listCategorias);
router.post('/categorias', createCategoria);
router.put('/categorias/:id', updateCategoriaCtrl);
router.delete('/categorias/:id', deleteCategoriaCtrl);

router.patch('/categorias/:id/active', setCategoriaAtivaCtrl);
router.get('/categorias/:categoriaId/subcategorias', listSubcategoriasByCategoria);

/* ========================= SUBCATEGORIAS ============================ */

router.get('/subcategorias', listSubcategorias);

// Legacy typo endpoint
router.post('/subcategororias', createSubcategoriaCtrl);

// Correct endpoint
router.post('/subcategorias', createSubcategoriaCtrl);

router.put('/subcategorias/:id', updateSubcategoriaCtrl);
router.delete('/subcategorias/:id', deleteSubcategoriaCtrl);

router.patch('/subcategorias/:id/active', setSubcategoriaAtivaCtrl);

/* ========================= ANEXOS =================================== */

// Upload fica em /api/upload/anexo

router.get('/movimentacoes/:id/anexos', listAnexosCaixa);
router.get('/movimentacoes/:id/anexos/count', countAnexosCaixa);
router.delete('/movimentacoes/:id/anexos/:anexoId', deleteAnexoCaixa);

// Compatibilidade antiga: /api/caixa/anexos?movimentacao_id=#
router.get('/anexos', (req, res) => {
  const id = Number(
    req.query.movimentacao_id ??
    req.query.cash_movement_id
  );

  if (!Number.isFinite(id)) {
    return res.status(400).json({
      ok: false,
      error: 'movimentacao_id inválido',
    });
  }

  req.params.id = String(id);
  return listAnexosCaixa(req, res);
});

/* ========================= RESUMO / SALDOS / RELATÓRIO ============= */

router.get('/summary', summary);
router.get('/saldos', saldos);

router.head('/relatorio/pdf', (_req, res) => res.status(200).end());
router.get('/relatorio/pdf', relatorioPdf);

// Compatibilidade com frontend antigo
router.get('/relatorio', relatorioPdf);

/* ========================= ZIP DE ANEXOS ============================= */

router.head('/movimentacoes/zip/periodo', headZipPeriodo);
router.get('/movimentacoes/zip/periodo', downloadZipPeriodo);

export default router;