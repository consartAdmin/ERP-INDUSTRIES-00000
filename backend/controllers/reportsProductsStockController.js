// ╔══════════════════════════════════════════════════════════════╗
// ║ FILE: reportsProductsStockController.js                      ║
// ╚══════════════════════════════════════════════════════════════╝

import pool from '../config/db.js';

import {
  getReportData,
  getStockPositionSummary
} from '../repositories/reportsProductsStock/reportsProductsStock.index.js';

import { generateReportsProductsStockExcel } from '../generationExcel/generationReportsProductsStockExcel.js';

export async function exportExcel(req, res) {
  try {
    const filters = req.query;

    const data = await getReportData(filters);

    console.log('======================================');
    console.log('[EXPORT EXCEL FILTERS]', filters);
    console.log('[EXPORT EXCEL TOTAL]', data.length);
    console.log('[EXPORT EXCEL FIRST]', data[0]);
    console.log('[EXPORT EXCEL 00006059]', data.find(x => x.codigo === '00006059'));
    console.log('======================================');

    return generateReportsProductsStockExcel(data, filters, res);
  } catch (err) {
    console.error('[REPORT EXCEL]', err);
    res.status(500).json({ error: err.message });
  }
}

export async function getStockPosition(req, res) {
  try {
    const data = await getStockPositionSummary();

    return res.json({
      ok: true,
      data
    });
  } catch (error) {
    console.error('[REPORTS_PRODUCTS_STOCK][POSITION][ERROR]', error);

    return res.status(500).json({
      ok: false,
      message: 'Erro ao carregar posição de estoque.',
      error: error.message
    });
  }
}