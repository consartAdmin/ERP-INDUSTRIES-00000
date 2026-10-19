// ╔════════════════════════════════════════════════════════════════════╗
/* ║ customersRoutes.js — Rotas Express (ESM)                          ║ */
// ╚════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import controller from '../controllers/customersController.js';
import { runWithCustomersTable } from '../repositories/customers/customers.table.js';
import { getErpCompany } from '../utils/erpCompany.js';

const router = Router();

// Telas da Consart ERP (header X-ERP-Company: CONSART ou ?company=CONSART)
// usam a tabela public."customersConsart"; o resto continua na customers.
router.use((req, _res, next) => runWithCustomersTable(getErpCompany(req), next));

// Dev/ops helper
router.post('/ensure', controller.ensureTable);

// 🔎 Busca leve (autocomplete/lookup)
router.get('/search', controller.search);

// ✅ RELATÓRIOS (PRECISAM VIR ANTES DO "/:id")
router.get('/report/pdf', controller.reportPdf);
router.get('/report/excel', controller.reportExcel);

// Listagem completa para grids
router.get('/', controller.list);

// This must appear before router.get('/:id', ...)
router.post('/sync-asaas', controller.syncAsaas);

// CRUD
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.updateById);
router.delete('/:id', controller.removeById);

export default router;
