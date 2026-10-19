// ╔══════════════════════════════════════════════════════════════════════╗
// ║ counterPanelCustomersRoutes.js — Routes (Counter Panel Cliente)      ║
// ║ CONSART ERP | ESM — Express Router                                   ║
// ║ 🔒 Cliente-only (read + mark viewed + download signed)               ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import {
  searchCounterPanelCustomers,
  getCounterPanelCustomerById,
  markCounterPanelCustomerViewed,
  markCounterPanelCustomerDownloaded,     // ✅ NOVO
  downloadCounterPanelCustomer,
  getCustomerCompetences,
  closeCustomerCompetence,               // ✅ NOVO
  getCustomerCompetenceChecklist,        // ✅ (opcional) NOVO
} from '../controllers/counterPanelCustomersController.js';

const router = Router();

/* =======================================================================
 * ROUTES (ORDER MATTERS)
 * - Rotas "fixas" primeiro
 * - Rotas com ":id" por último
 * ===================================================================== */

// ✅ Lista anos/meses reais existentes no bucket
router.get('/counter-panel/customers/competences', getCustomerCompetences);

// 📄 Listar / pesquisar documentos do cliente
// (Aqui você já pode incluir filtros: q, type, status)
router.get('/counter-panel/customers', searchCounterPanelCustomers);

// ✅ (Opcional) Checklist da competência (Jan/2026 ✅/❌)
router.get('/counter-panel/customers/checklist', getCustomerCompetenceChecklist);

// ✅ Fechar competência (bloqueia uploads tardios)
router.post('/counter-panel/customers/competence/close', closeCustomerCompetence);

// 📄 Detalhe de um documento
router.get('/counter-panel/customers/:id', getCounterPanelCustomerById);

// ⬇️ Download (URL assinada fresca)
router.get('/counter-panel/customers/:id/download', downloadCounterPanelCustomer);

// 👁️ Marcar como visualizado
router.patch('/counter-panel/customers/:id/viewed', markCounterPanelCustomerViewed);

// ✅ Marcar como baixado (Status visual “Baixado”)
router.patch('/counter-panel/customers/:id/downloaded', markCounterPanelCustomerDownloaded);

/* =======================================================================
 * OPTIONAL (SAFE) — você pode remover se não quiser
 * ===================================================================== */

// Health ping da feature (não afeta nada)
router.get('/counter-panel/customers/_health', (_req, res) =>
  res.json({ ok: true, feature: 'counter-panel-customers' })
);

// Alias legado (caso exista frontend antigo com path diferente)
// Se não usa, pode remover.
router.all('/counter-panel/customer/*', (req, res) => {
  return res.status(410).json({
    ok: false,
    error: 'Legacy route removed. Use /counter-panel/customers/*',
    method: req.method,
    path: req.originalUrl
  });
});

export default router;
