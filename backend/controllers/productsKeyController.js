//╔════════════════════════════════════════════════════════════════════════════╗
//║ 🔑 productsKeyController.js — Controller: ProductsKey (CONSART ERP | ESM) ║
//║ - Endpoints REST para keys (IA / matching)                                ║
//║ - Usa: services/apis/productsKeyApi.js                                    ║
//╚════════════════════════════════════════════════════════════════════════════╝

import productsKeyApi from '../repositories/productsKey/productsKey.index.js';

function toInt(v, def = undefined) {
  if (v === undefined || v === null || v === '') return def;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}

function sendError(res, err) {
  const msg = err?.message || 'Erro inesperado';

  // erros de validação simples
  const isBadRequest =
    /obrigatório|inválido|vazio/i.test(msg) ||
    msg.includes('is not a valid') ||
    msg.includes('invalid');

  res.status(isBadRequest ? 400 : 500).json({ ok: false, error: msg });
}

/* ────────────────────────────────────────────────────────────────────────── */
/* POST /api/products-key/ensure                                              */
/* ────────────────────────────────────────────────────────────────────────── */
export async function ensure(req, res) {
  try {
    const out = await productsKeyApi.ensureTable();
    res.json({ ok: true, ...out });
  } catch (err) {
    sendError(res, err);
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/* GET /api/products-key                                                       */
/* Query: q, product_code, limit, offset, orderBy, order                       */
/* ────────────────────────────────────────────────────────────────────────── */
export async function list(req, res) {
  try {
    const { q, product_code, orderBy, order } = req.query;
    const limit = toInt(req.query.limit, 50);
    const offset = toInt(req.query.offset, 0);

    const rows = await productsKeyApi.list({
      q,
      product_code,
      limit,
      offset,
      orderBy,
      order,
    });

    res.json({ ok: true, data: rows });
  } catch (err) {
    sendError(res, err);
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/* GET /api/products-key/:id                                                   */
/* ────────────────────────────────────────────────────────────────────────── */
export async function getById(req, res) {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: 'ID inválido.' });

    const row = await productsKeyApi.getById(id);
    if (!row) return res.status(404).json({ ok: false, error: 'Registro não encontrado.' });

    res.json({ ok: true, data: row });
  } catch (err) {
    sendError(res, err);
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/* POST /api/products-key                                                      */
/* Body: { product_code, word_keys, word_keys_norm? }                          */
/* - Faz UPSERT (sem duplicar product_code + word_keys_norm)                   */
/* ────────────────────────────────────────────────────────────────────────── */
export async function upsert(req, res) {
  try {
    const { product_code, word_keys, word_keys_norm } = req.body || {};

    const row = await productsKeyApi.upsert({
      product_code,
      word_keys,
      word_keys_norm,
    });

    res.json({ ok: true, data: row });
  } catch (err) {
    sendError(res, err);
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/* DELETE /api/products-key/:id                                                */
/* ────────────────────────────────────────────────────────────────────────── */
export async function remove(req, res) {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: 'ID inválido.' });

    const out = await productsKeyApi.remove(id);
    if (!out.ok) return res.status(404).json({ ok: false, error: 'Registro não encontrado.' });

    res.json({ ok: true, ...out });
  } catch (err) {
    sendError(res, err);
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/* POST /api/products-key/resolve                                              */
/* Body: { text, limit?, product_code? }                                       */
/* ────────────────────────────────────────────────────────────────────────── */
export async function resolve(req, res) {
  try {
    const { text, product_code } = req.body || {};
    const limit = toInt(req.body?.limit, 10);

    const out = await productsKeyApi.resolve({
      text,
      limit,
      product_code,
    });

    res.json({ ok: true, data: out });
  } catch (err) {
    sendError(res, err);
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/* POST /api/products-key/normalize                                            */
/* Body: { text } -> { normalized }                                            */
/* ────────────────────────────────────────────────────────────────────────── */
export async function normalize(req, res) {
  try {
    const text = String(req.body?.text ?? '').trim();
    if (!text) return res.status(400).json({ ok: false, error: 'text é obrigatório.' });

    const normalized = productsKeyApi.normalizeKeyText(text);
    res.json({ ok: true, data: { normalized } });
  } catch (err) {
    sendError(res, err);
  }
}
