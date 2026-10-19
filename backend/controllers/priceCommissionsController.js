// ╔══════════════════════════════════════════════════════════════════════╗
// ║ priceCommissionsController.js — Controller | CONSART ERP (ESM)       ║
// ║ Rotas: /api/price-commissions                                        ║
// ║ Path: /backend/controllers/priceCommissionsController.js             ║
// ╚══════════════════════════════════════════════════════════════════════╝

import priceCommissionsApi from '../repositories/priceCommissions/priceCommissions.index.js';

export async function initPriceCommissionsController() {
  try {
    await priceCommissionsApi.ensureTables?.();
  } catch (err) {
    console.error('initPriceCommissionsController() failed:', err);
  }
}

export async function listPriceCommissions(req, res) {
  try {
    const {
      q = '',
      price_id,
      seller_id,
      active,
      date,
      dateFrom,
      dateTo,
      limit = 200,
      offset = 0,
    } = req.query;

    const out = await priceCommissionsApi.list({
      q,
      price_id,
      seller_id,
      active,
      date,
      dateFrom,
      dateTo,
      limit: Number(limit) || 200,
      offset: Number(offset) || 0,
    });

    if (!out?.ok) return res.status(400).json(out);

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    return res.json(out);
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}

export async function getPriceCommissionById(req, res) {
  try {
    const out = await priceCommissionsApi.getById(req.params.id);
    if (!out?.ok) {
      const code = out.error === 'NOT_FOUND' ? 404 : 400;
      return res.status(code).json(out);
    }
    return res.json(out);
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}

export async function createPriceCommission(req, res) {
  try {
    const out = await priceCommissionsApi.create(req.body ?? {});
    if (!out?.ok) return res.status(400).json(out);
    return res.status(201).json(out);
  } catch (err) {
    return res.status(400).json({ ok: false, error: String(err?.message || err) });
  }
}

export async function updatePriceCommission(req, res) {
  try {
    const out = await priceCommissionsApi.update(req.params.id, req.body ?? {});
    if (!out?.ok) {
      const code = out.error === 'NOT_FOUND' ? 404 : 400;
      return res.status(code).json(out);
    }
    return res.json(out);
  } catch (err) {
    return res.status(400).json({ ok: false, error: String(err?.message || err) });
  }
}

export async function deletePriceCommission(req, res) {
  try {
    const out = await priceCommissionsApi.remove(req.params.id);
    if (!out?.ok) return res.status(400).json(out);
    return res.json(out);
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}

// combos auxiliares
export async function listPrices(req, res) {
  try {
    const activeOnly = String(req.query.activeOnly ?? 'true') !== 'false';
    const out = await priceCommissionsApi.listPrices({ activeOnly });
    if (!out?.ok) return res.status(400).json(out);
    return res.json(out);
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}

export async function listSellers(req, res) {
  try {
    const activeOnly = String(req.query.activeOnly ?? 'true') !== 'false';
    const out = await priceCommissionsApi.listSellers({ activeOnly });
    if (!out?.ok) return res.status(400).json(out);
    return res.json(out);
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
