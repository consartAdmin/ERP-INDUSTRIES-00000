// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: salesTaxCalculationRoutes.js                                   ║
// ║ MODULE: SALES TAX CALCULATION                                        ║
// ║ CONSART ERP                                                          ║
// ║ ROUTES LAYER                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import express from 'express';

import {
  calculateOrderTaxes,
  calculatePeriodTaxes,
  listTaxCalculations,
  getTaxCalculation,
  getTaxPeriodSummary,
  exportSalesTaxPdf,
  exportSalesTaxExcel
} from '../controllers/salesTaxCalculationController.js';

const router = express.Router();

/* ======================================================================
   CALCULATE TAXES FROM ONE ORDER
   ====================================================================== */
router.post('/sales-tax/calculate/:orderId', calculateOrderTaxes);

/* ======================================================================
   CALCULATE TAXES FROM PERIOD
   ====================================================================== */
router.post('/sales-tax/calculate-period', calculatePeriodTaxes);

/* ======================================================================
   PERIOD SUMMARY
   ====================================================================== */
router.get('/sales-tax/period', getTaxPeriodSummary);

/* ======================================================================
   EXPORT PDF
   ====================================================================== */
router.get('/sales-tax/export/pdf', exportSalesTaxPdf);

/* ======================================================================
   EXPORT EXCEL
   ====================================================================== */
router.get('/sales-tax/export/excel', exportSalesTaxExcel);

/* ======================================================================
   LIST CALCULATIONS
   ====================================================================== */
router.get('/sales-tax', listTaxCalculations);

/* ======================================================================
   GET CALCULATION
   ====================================================================== */
router.get('/sales-tax/:id', getTaxCalculation);

export default router;