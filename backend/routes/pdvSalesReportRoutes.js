// ╔══════════════════════════════════════════════════════════════════════╗
// ║ pdvSalesReportRoutes.js — Rotas Relatório PDV (Backend ESM)         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import {
  getPdvSalesReport,
  downloadPdvSalesXmls
} from '../controllers/pdvSalesReportController.js';
import {
  getPdvSalesReportPdf,
  getPdvSalesReportCsv,
} from '../controllers/pdvSalesReportPdfController.js';

const router = Router();

// JSON (usado pelo dashboard)
router.get('/', getPdvSalesReport);

// PDF
router.get('/pdf', getPdvSalesReportPdf);

// CSV
router.get('/csv', getPdvSalesReportCsv);

// XML
router.get('/xml', downloadPdvSalesXmls);

export default router;
