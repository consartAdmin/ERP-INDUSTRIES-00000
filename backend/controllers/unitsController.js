// ╔══════════════════════════════════════════════════════════════════════╗
// ║ unitsController.js — Controllers HTTP para `units` (Express ESM)    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import * as Units from '../repositories/units/units.index.js';

const ok   = (res, data, status = 200) => res.status(status).json({ ok: true, data });
const fail = (res, error, status = 400) => res.status(status).json({ ok: false, error: String(error?.message || error) });

export async function ensure(_req, res) {
  try { const r = await Units.ensureTable(); ok(res, r); }
  catch (e) { fail(res, e, 500); }
}

export async function list(req, res) {
  try {
    const { q, limit, offset, onlyActive } = req.query;
    const data = await Units.list({ q, limit, offset, onlyActive });
    ok(res, data);
  } catch (e) {
    fail(res, e, 500);
  }
}

export async function getById(req, res) {
  try {
    const id = Number(req.params.id);
    const data = await Units.getById(id);
    if (!data) return fail(res, new Error('Not Found'), 404);
    ok(res, data);
  } catch (e) {
    fail(res, e, 500);
  }
}

export async function create(req, res) {
  try {
    const { unit, description, fator, is_active } = req.body || {};
    const data = await Units.create({ unit, description, fator, is_active });
    ok(res, data, 201);
  } catch (e) {
    fail(res, e, 400);
  }
}

export async function upsert(req, res) {
  try {
    const { unit, description, fator, is_active } = req.body || {};
    const data = await Units.upsertByUnit({ unit, description, fator, is_active });
    ok(res, data);
  } catch (e) {
    fail(res, e, 400);
  }
}

export async function update(req, res) {
  try {
    const id = Number(req.params.id);
    const data = await Units.update(id, req.body || {});
    if (!data) return fail(res, new Error('Not Found'), 404);
    ok(res, data);
  } catch (e) {
    fail(res, e, 400);
  }
}

export async function deactivate(req, res) {
  try {
    const id = Number(req.params.id);
    const data = await Units.deactivate(id);
    if (!data) return fail(res, new Error('Not Found'), 404);
    ok(res, data);
  } catch (e) {
    fail(res, e, 400);
  }
}

export async function remove(req, res) {
  try {
    const id = Number(req.params.id);
    const data = await Units.remove(id);
    if (!data) return fail(res, new Error('Not Found'), 404);
    ok(res, data);
  } catch (e) {
    fail(res, e, 400);
  }
}

export default {
  ensure,
  list,
  getById,
  create,
  upsert,
  update,
  deactivate,
  remove,
};
