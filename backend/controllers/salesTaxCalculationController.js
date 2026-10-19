// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: salesTaxCalculationController.js                               ║
// ║ MODULE: SALES TAX CALCULATION                                        ║
// ║ CONSART ERP                                                          ║
// ║ CONTROLLER LAYER                                                     ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  calculateOrderSalesTaxes,
  calculateSalesTaxesByPeriod,
  listSalesTaxCalculations,
  getSalesTaxCalculationById,
  getSalesTaxPeriodSummary
} from '../services/salesTaxCalculationService.js';

import generateSalesTaxCalculationPdf from '../generationPdf/generationSalesTaxCalculationPdf.js';
import generateSalesTaxCalculationExcel from '../generationExcel/generationSalesTaxCalculationExcel.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ======================================================================
   HELPERS
   ====================================================================== */

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function safeFilePart(value) {
  return String(value ?? '')
    .trim()
    .replace(/[^\dA-Za-z_-]/g, '-');
}


/* ======================================================================
   CALCULATE TAXES FROM ORDER
   ====================================================================== */
export async function calculateOrderTaxes(req, res) {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({ error: 'orderId is required' });
    }

    const result = await calculateOrderSalesTaxes(orderId);
    return res.json(result);

  } catch (error) {
    console.error('calculateOrderTaxes:', error);
    return res.status(500).json({
      error: 'Tax calculation failed',
      details: error.message
    });
  }
}


/* ======================================================================
   CALCULATE TAXES FROM PERIOD
   ====================================================================== */
export async function calculatePeriodTaxes(req, res) {
  try {
    const { date_from, date_to } = req.body || {};

    if (!date_from || !date_to) {
      return res.status(400).json({
        error: 'date_from and date_to are required'
      });
    }

    const result = await calculateSalesTaxesByPeriod(date_from, date_to);

    return res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('calculatePeriodTaxes:', error);
    return res.status(500).json({
      error: 'Failed to calculate taxes by period',
      details: error.message
    });
  }
}


/* ======================================================================
   PERIOD SUMMARY
   ====================================================================== */
export async function getTaxPeriodSummary(req, res) {
  try {
    const { date_from, date_to } = req.query;

    if (!date_from || !date_to) {
      return res.status(400).json({
        error: 'date_from and date_to are required'
      });
    }

    const data = await getSalesTaxPeriodSummary(date_from, date_to);
    return res.json(data);

  } catch (error) {
    console.error('getTaxPeriodSummary:', error);
    return res.status(500).json({
      error: 'Failed to load period summary',
      details: error.message
    });
  }
}


/* ======================================================================
   LIST TAX CALCULATIONS
   ====================================================================== */
export async function listTaxCalculations(req, res) {
  try {
    const rows = await listSalesTaxCalculations(req.query);
    return res.json(rows);
  } catch (error) {
    console.error('listTaxCalculations:', error);
    return res.status(500).json({
      error: 'Failed to list tax calculations'
    });
  }
}


/* ======================================================================
   GET TAX CALCULATION BY ID
   ====================================================================== */
export async function getTaxCalculation(req, res) {
  try {
    const { id } = req.params;

    const data = await getSalesTaxCalculationById(id);

    if (!data) {
      return res.status(404).json({
        error: 'Calculation not found'
      });
    }

    return res.json(data);

  } catch (error) {
    console.error('getTaxCalculation:', error);
    return res.status(500).json({
      error: 'Failed to fetch calculation'
    });
  }
}


/* ======================================================================
   EXPORT PDF
   ====================================================================== */
export async function exportSalesTaxPdf(req, res) {
  try {
    const { date_from, date_to } = req.query;

    if (!date_from || !date_to) {
      return res.status(400).json({
        error: 'date_from and date_to are required'
      });
    }

    const data = await getSalesTaxPeriodSummary(date_from, date_to);

    const outputDir = path.resolve(__dirname, '../public/temp/sales-tax');
    ensureDir(outputDir);

    const fileName = `sales-tax-${safeFilePart(date_from)}-${safeFilePart(date_to)}.pdf`;
    const outputFilePath = path.join(outputDir, fileName);

    await generateSalesTaxCalculationPdf(data, outputFilePath);

    return res.download(outputFilePath, fileName);

  } catch (error) {
    console.error('exportSalesTaxPdf:', error);
    return res.status(500).json({
      error: 'Failed to export PDF',
      details: error.message
    });
  }
}


/* ======================================================================
   EXPORT EXCEL
   ====================================================================== */
export async function exportSalesTaxExcel(req, res) {
  try {
    const { date_from, date_to } = req.query;

    if (!date_from || !date_to) {
      return res.status(400).json({
        error: 'date_from and date_to are required'
      });
    }

    const data = await getSalesTaxPeriodSummary(date_from, date_to);

    const outputDir = path.resolve(__dirname, '../public/temp/sales-tax');
    ensureDir(outputDir);

    const fileName = `sales-tax-${safeFilePart(date_from)}-${safeFilePart(date_to)}.xlsx`;
    const outputFilePath = path.join(outputDir, fileName);

    await generateSalesTaxCalculationExcel(data, outputFilePath);

    return res.download(outputFilePath, fileName);

  } catch (error) {
    console.error('exportSalesTaxExcel:', error);
    return res.status(500).json({
      error: 'Failed to export Excel',
      details: error.message
    });
  }
}