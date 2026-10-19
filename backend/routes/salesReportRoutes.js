// ╔══════════════════════════════════════════════════════════════════════╗
// ║ salesReportRoutes.js — Rotas do Relatório de Vendas (ESM)         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { Router } from 'express';
import {
  handleGetSalesReport,
  handleGetSalesReportPdf,
} from '../controllers/salesReportController.js';

const router = Router();

// Montagem esperada no server.js:
// app.use('/api/reports', salesReportRoutes);
router.get('/sales', handleGetSalesReport);
router.get('/sales/pdf', handleGetSalesReportPdf);

export default router;
