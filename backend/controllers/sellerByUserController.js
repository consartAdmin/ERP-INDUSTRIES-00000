// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║ sellerByUserController.js — Controller (Usuário x Vendedor) | CONSART ERP    ║
// ║ Base: /api/seller-by-user                                                    ║
// ║ ESM • Express                                                                ║
// ║                                                                              ║
// ║ ✅ ensureTables automático (não depende do /init)                             ║
// ║ ✅ CRUD + helpers: getByUserId, setPrimary, toggleActive                      ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import {
  ensureTables,
  list,
  getById,
  getByUserId,
  create,
  update,
  remove,
  toggleActive,
  setPrimary,
} from '../repositories/sellerByUser/sellerByUser.index.js';

const ok = (res, data = {}) => res.json({ ok: true, ...data });
const bad = (res, msg = 'Erro', code = 400, extra = {}) =>
  res.status(code).json({ ok: false, error: msg, ...extra });

const asInt = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const asBool = (v) => {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  if (['1', 'true', 't', 'yes', 'y', 'on'].includes(s)) return true;
  if (['0', 'false', 'f', 'no', 'n', 'off'].includes(s)) return false;
  return undefined;
};

/* --------------------------------------------------------------------- */
/* Infra                                                                  */
/* --------------------------------------------------------------------- */
async function boot() {
  await ensureTables();
}

/* --------------------------------------------------------------------- */
/* Handlers                                                               */
/* --------------------------------------------------------------------- */
export async function init(req, res) {
  try {
    await boot();
    return ok(res, { message: 'sellerByUser: ok' });
  } catch (e) {
    return bad(res, e.message || 'Falha ao inicializar', 500);
  }
}

export async function listSellerByUser(req, res) {
  try {
    await boot();

    const q = req.query || {};
    const user_id = asInt(q.user_id);
    const seller_id = asInt(q.seller_id);
    const active = asBool(q.active);

    const limit = asInt(q.limit) ?? 200;
    const offset = asInt(q.offset) ?? 0;

    const rows = await list({ user_id, seller_id, active, limit, offset });
    return ok(res, { rows });
  } catch (e) {
    return bad(res, e.message || 'Falha ao listar vínculos', 500);
  }
}

export async function getSellerByUserById(req, res) {
  try {
    await boot();

    const id = asInt(req.params.id);
    if (!id) return bad(res, 'id inválido');

    const row = await getById(id);
    if (!row) return bad(res, 'Registro não encontrado', 404);

    return ok(res, { row });
  } catch (e) {
    return bad(res, e.message || 'Falha ao buscar registro', 500);
  }
}

export async function listSellerByUserByUser(req, res) {
  try {
    await boot();

    const userId = asInt(req.params.userId);
    if (!userId) return bad(res, 'userId inválido');

    const rows = await getByUserId(userId);
    return ok(res, { rows });
  } catch (e) {
    return bad(res, e.message || 'Falha ao listar por usuário', 500);
  }
}

export async function createSellerByUser(req, res) {
  try {
    await boot();

    const body = req.body || {};
    const user_id = asInt(body.user_id);
    const seller_id = asInt(body.seller_id);
    const is_primary = asBool(body.is_primary) ?? false;
    const active = asBool(body.active) ?? true;

    if (!user_id) return bad(res, 'user_id é obrigatório');
    if (!seller_id) return bad(res, 'seller_id é obrigatório');

    const row = await create({ user_id, seller_id, is_primary, active });
    return ok(res, { row });
  } catch (e) {
    // violações comuns (unique do primary)
    const msg = e?.message || 'Falha ao criar vínculo';
    return bad(res, msg, 500);
  }
}

export async function updateSellerByUser(req, res) {
  try {
    await boot();

    const id = asInt(req.params.id);
    if (!id) return bad(res, 'id inválido');

    const patch = req.body || {};
    // valida campos se vierem
    if (patch.user_id !== undefined && asInt(patch.user_id) === null) return bad(res, 'user_id inválido');
    if (patch.seller_id !== undefined && asInt(patch.seller_id) === null) return bad(res, 'seller_id inválido');
    if (patch.is_primary !== undefined && asBool(patch.is_primary) === undefined) return bad(res, 'is_primary inválido');
    if (patch.active !== undefined && asBool(patch.active) === undefined) return bad(res, 'active inválido');

    const normalized = {};
    if (patch.user_id !== undefined) normalized.user_id = asInt(patch.user_id);
    if (patch.seller_id !== undefined) normalized.seller_id = asInt(patch.seller_id);
    if (patch.is_primary !== undefined) normalized.is_primary = asBool(patch.is_primary);
    if (patch.active !== undefined) normalized.active = asBool(patch.active);

    const row = await update(id, normalized);
    if (!row) return bad(res, 'Registro não encontrado', 404);

    return ok(res, { row });
  } catch (e) {
    return bad(res, e.message || 'Falha ao atualizar vínculo', 500);
  }
}

export async function removeSellerByUser(req, res) {
  try {
    await boot();

    const id = asInt(req.params.id);
    if (!id) return bad(res, 'id inválido');

    const deletedId = await remove(id);
    if (!deletedId) return bad(res, 'Registro não encontrado', 404);

    return ok(res, { id: deletedId });
  } catch (e) {
    return bad(res, e.message || 'Falha ao remover vínculo', 500);
  }
}

export async function toggleSellerByUserActive(req, res) {
  try {
    await boot();

    const id = asInt(req.params.id);
    if (!id) return bad(res, 'id inválido');

    const active = asBool(req.body?.active);
    if (active === undefined) return bad(res, 'active é obrigatório (true/false)');

    const row = await toggleActive(id, active);
    if (!row) return bad(res, 'Registro não encontrado', 404);

    return ok(res, { row });
  } catch (e) {
    return bad(res, e.message || 'Falha ao alternar active', 500);
  }
}

export async function setSellerByUserPrimary(req, res) {
  try {
    await ensureTables();

    const userId = Number(req.params.userId);
    const id = Number(req.params.id);

    if (!userId) return res.status(400).json({ ok: false, error: 'userId inválido' });
    if (!id) return res.status(400).json({ ok: false, error: 'id inválido' });

    const row = await setPrimary(userId, id);
    if (!row) return res.status(404).json({ ok: false, error: 'Registro não encontrado (id/userId)' });

    return res.json({ ok: true, row });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || 'Falha ao definir principal' });
  }
}

