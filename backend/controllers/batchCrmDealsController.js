// ╔══════════════════════════════════════════════════════════════╗
// ║ batchCrmDealsController.js — Controller CRM Deals em Lote   ║
// ║ CONSART ERP | ESM                                           ║
// ╚══════════════════════════════════════════════════════════════╝

import batchCrmDealsApi from '../repositories/batchCrmDeals/batchCrmDeals.index.js';

function text(value) {
  return String(value ?? '').trim();
}

function numberOrDefault(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function searchCustomers(req, res) {
  try {
    const q = text(req.query.q);
    const limit = numberOrDefault(req.query.limit, 100);

    const result = await batchCrmDealsApi.searchCustomers({ q, limit });

    return res.json(result);
  } catch (err) {
    console.error('[batchCrmDealsController.searchCustomers]', err);

    return res.status(500).json({
      ok: false,
      error: err?.message || 'BATCH_CRM_CUSTOMERS_SEARCH_ERROR',
    });
  }
}

export async function createBatchDeals(req, res) {
  try {
    const { customers = [], defaults = {} } = req.body || {};

    const result = await batchCrmDealsApi.createBatchDeals({
      customers,
      defaults,
    });

    if (!result.ok) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (err) {
    console.error('[batchCrmDealsController.createBatchDeals]', err);

    return res.status(500).json({
      ok: false,
      error: err?.message || 'BATCH_CRM_CREATE_ERROR',
    });
  }
}

export default {
  searchCustomers,
  createBatchDeals,
};