// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ pricesController.js — Price Tables (CONSART ERP | ESM)                   ║
// ║ - GET /api/prices                     -> dropdown (rows simples)         ║
// ║ - GET /api/price-tables               -> list completa (q/paginação)     ║
// ║ - GET /api/price-tables/:id           -> getById                         ║
// ║ - POST /api/price-tables              -> create                          ║
// ║ - PUT /api/price-tables/:id           -> update                          ║
// ║ - DELETE /api/price-tables/:id        -> soft delete                      ║
// ║ - POST /api/price-tables/:id/restore  -> restore                         ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import {
  listSimple,
  list,
  getById,
  create,
  update,
  softDelete,
  permanentDelete,
  restore,
} from '../repositories/prices/prices.index.js';

const ok = (res, data = {}) => res.json({ ok: true, ...data });
const bad = (res, message = 'Erro', code = 400, extra = {}) =>
  res.status(code).json({ ok: false, message, ...extra });

/** GET /api/prices (dropdown) */
export async function dropdown(req, res) {
  try {
    const rows = await listSimple({ onlyActive: true });
    return ok(res, { rows });
  } catch (err) {
    console.error('[prices:dropdown] ERR:', err);
    return bad(res, 'Falha ao listar tabelas de preço.', 500, { detail: String(err.message || err) });
  }
}

/** GET /api/price-tables (full list) */
export async function listFull(req, res) {
  try {
    const q = (req.query.q || '').trim();
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 50);
    const sort = (req.query.sort || 'name').trim();
    const dir = (req.query.dir || 'asc').trim();
    const onlyActive = req.query.active === 'true';

    const data = await list({ q, page, limit, sort, dir, onlyActive });
    return ok(res, { data });
  } catch (err) {
    console.error('[prices:listFull] ERR:', err);
    return bad(res, 'Falha ao listar tabelas (completo).', 500, { detail: String(err.message || err) });
  }
}

/** GET /api/price-tables/:id */
export async function getOne(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return bad(res, 'ID inválido.');

    const row = await getById(id);
    if (!row) return bad(res, 'Tabela de preço não encontrada.', 404);
    return ok(res, { data: row });
  } catch (err) {
    console.error('[prices:getOne] ERR:', err);
    return bad(res, 'Falha ao buscar tabela.', 500, { detail: String(err.message || err) });
  }
}

/** POST /api/price-tables */
export async function createOne(req, res) {
  try {
    const { name, description = null, active = true } = req.body || {};
    if (!name || !String(name).trim()) return bad(res, 'Campo "name" é obrigatório.');

    const row = await create({ name, description, active });
    return res.status(201).json({ ok: true, data: row });
  } catch (err) {
    console.error('[prices:createOne] ERR:', err);
    return bad(res, 'Falha ao criar tabela.', 500, { detail: String(err.message || err) });
  }
}

/** PUT /api/price-tables/:id */
export async function updateOne(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return bad(res, 'ID inválido.');

    const { name, description, active } = req.body || {};
    const row = await update(id, { name, description, active });
    if (!row) return bad(res, 'Tabela de preço não encontrada.', 404);
    return ok(res, { data: row });
  } catch (err) {
    console.error('[prices:updateOne] ERR:', err);
    return bad(res, 'Falha ao atualizar tabela.', 500, { detail: String(err.message || err) });
  }
}

/** DELETE /api/price-tables/:id */
export async function removeOne(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return bad(res, 'ID inválido.');

    const row = await softDelete(id);
    if (!row) return bad(res, 'Tabela de preço não encontrada.', 404);
    return ok(res, { data: row });
  } catch (err) {
    console.error('[prices:removeOne] ERR:', err);
    return bad(res, 'Falha ao remover tabela.', 500, { detail: String(err.message || err) });
  }
}

/** POST /api/price-tables/:id/restore */
export async function restoreOne(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return bad(res, 'ID inválido.');

    const row = await restore(id);
    if (!row) return bad(res, 'Tabela de preço não encontrada.', 404);
    return ok(res, { data: row });
  } catch (err) {
    console.error('[prices:restoreOne] ERR:', err);
    return bad(res, 'Falha ao restaurar tabela.', 500, { detail: String(err.message || err) });
  }
}

/**
 * DELETE /api/price-tables/:id/permanent
 */
export async function permanentRemoveOne(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isFinite(id) || id <= 0) {
      return bad(res, 'ID inválido.');
    }

    const row = await permanentDelete(id);

    if (!row) {
      return bad(res, 'Tabela de preço não encontrada.', 404);
    }

    return ok(res, { data: row });
  } catch (err) {
    console.error('[prices:permanentRemoveOne] ERR:', err);

    // PostgreSQL: registro referenciado por outra tabela.
    if (err?.code === '23503') {
      return bad(
        res,
        'Esta tabela de preço está sendo utilizada e não pode ser excluída permanentemente.',
        409,
      );
    }

    return bad(res, 'Falha ao excluir permanentemente a tabela.', 500, {
      detail: String(err.message || err),
    });
  }
}

export default {
  dropdown,
  listFull,
  getOne,
  createOne,
  updateOne,
  removeOne,
  permanentRemoveOne,
  restoreOne,
};