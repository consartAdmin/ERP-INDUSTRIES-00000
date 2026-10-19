// ╔════════════════════════════════════════════════════════════════════╗
// ║ customersIbgeController.js — Controller Express (ESM)               ║
// ║ CONSART ERP | Customers IBGE                                       ║
// ║ Rotas (via routes):                                                ║
// ║  POST   /api/customers-ibge/ensure                                 ║
// ║  GET    /api/customers-ibge                                        ║
// ║  GET    /api/customers-ibge/search                                 ║
// ║  GET    /api/customers-ibge/:customerId                            ║
// ║  GET    /api/customers-ibge/resolve                                ║
// ║  POST   /api/customers-ibge/:customerId                            ║
// ║  PATCH  /api/customers-ibge/:customerId                            ║
// ║  DELETE /api/customers-ibge/:customerId                            ║
// ╚════════════════════════════════════════════════════════════════════╝

import customersIbgeApi from '../repositories/customersIbge/customersIbge.index.js';

const ok = (res, data, status = 200) => res.status(status).json({ ok: true, ...data });
const fail = (res, error, status = 400) =>
  res.status(status).json({ ok: false, error: String(error?.message || error) });

const toInt = (v, def) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

export async function ensure(req, res) {
  try {
    const r = await customersIbgeApi.ensureTable();
    if (!r.ok) return fail(res, r.error || 'ensure_failed', 500);
    return ok(res, r);
  } catch (e) {
    return fail(res, e, 500);
  }
}

export async function list(req, res) {
  try {
    const limit = toInt(req.query.limit, 20);
    const offset = toInt(req.query.offset, 0);

    const r = await customersIbgeApi.list({ limit, offset });
    if (!r.ok) return fail(res, r.error || 'list_failed', 500);

    return ok(res, { rows: r.rows, total: r.total });
  } catch (e) {
    return fail(res, e, 500);
  }
}

export async function search(req, res) {
  try {
    const {
      q,
      uf,
      city,
      ibgeCode,
      source,
      minConfidence,
    } = req.query;

    const limit = toInt(req.query.limit, 20);
    const offset = toInt(req.query.offset, 0);

    const r = await customersIbgeApi.search({
      q,
      uf,
      city,
      ibgeCode,
      source,
      minConfidence: minConfidence != null ? toInt(minConfidence, undefined) : undefined,
      limit,
      offset,
    });

    if (!r.ok) return fail(res, r.error || 'search_failed', 500);
    return ok(res, { rows: r.rows, total: r.total });
  } catch (e) {
    return fail(res, e, 500);
  }
}

export async function getByCustomerId(req, res) {
  try {
    const id = toInt(req.params.customerId, NaN);
    if (!Number.isFinite(id) || id <= 0) return fail(res, 'ID inválido', 400);

    const r = await customersIbgeApi.getByCustomerId(id);
    if (!r.ok) {
      if (r.error === 'NOT_FOUND') return fail(res, 'NOT_FOUND', 404);
      return fail(res, r.error || 'get_failed', 500);
    }

    return ok(res, { row: r.row });
  } catch (e) {
    return fail(res, e, 500);
  }
}

// Resolve por UF + cidade (para preencher código IBGE)
export async function resolve(req, res) {
  try {
    const uf = req.query.uf;
    const city = req.query.city;

    if (!uf || !city) return fail(res, 'Informe uf e city', 400);

    const r = await customersIbgeApi.getByUfCity(uf, city);
    if (!r.ok) {
      if (r.error === 'NOT_FOUND') return fail(res, 'NOT_FOUND', 404);
      return fail(res, r.error || 'resolve_failed', 500);
    }

    return ok(res, { row: r.row });
  } catch (e) {
    return fail(res, e, 500);
  }
}

export async function upsert(req, res) {
  try {
    const id = toInt(req.params.customerId, NaN);
    if (!Number.isFinite(id) || id <= 0) return fail(res, 'ID inválido', 400);

    const payload = req.body || {};
    const r = await customersIbgeApi.upsert(id, payload);

    if (!r.ok) return fail(res, r.error || 'upsert_failed', 400);
    return ok(res, { row: r.row }, 201);
  } catch (e) {
    return fail(res, e, 500);
  }
}

export async function patch(req, res) {
  try {
    const id = toInt(req.params.customerId, NaN);
    if (!Number.isFinite(id) || id <= 0) return fail(res, 'ID inválido', 400);

    const patchBody = req.body || {};
    const r = await customersIbgeApi.update(id, patchBody);

    if (!r.ok) {
      if (r.error === 'NOT_FOUND') return fail(res, 'NOT_FOUND', 404);
      return fail(res, r.error || 'update_failed', 400);
    }

    return ok(res, { row: r.row });
  } catch (e) {
    return fail(res, e, 500);
  }
}

export async function remove(req, res) {
  try {
    const id = toInt(req.params.customerId, NaN);
    if (!Number.isFinite(id) || id <= 0) return fail(res, 'ID inválido', 400);

    const r = await customersIbgeApi.remove(id);
    if (!r.ok) return fail(res, r.error || 'remove_failed', 500);

    return ok(res, { deleted: r.deleted });
  } catch (e) {
    return fail(res, e, 500);
  }
}

export default {
  ensure,
  list,
  search,
  resolve,
  getByCustomerId,
  upsert,
  patch,
  remove,
};
