// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerStatusTypesController.js — Customer Status Types (ERP)    ║
// ║ Regras de negócio + HTTP handlers                                 ║
// ╚════════════════════════════════════════════════════════════════════╝

import * as customerStatusTypesApi from '../repositories/customerStatusTypes/customerStatusTypes.index.js';

const parseBoolOrNull = (v) => {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'boolean') return v;
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  return null;
};

const parseIntOrNull = (v) => {
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
};

async function ensureTable(req, res, next) {
  try {
    const result = await customerStatusTypesApi.ensureTable();
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const payload = req.body || {};
    const row = await customerStatusTypesApi.create(payload);
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
}

async function updateById(req, res, next) {
  try {
    const { id } = req.params;
    const payload = req.body || {};
    const row = await customerStatusTypesApi.updateById(id, payload);
    if (!row) {
      return res.status(404).json({ error: 'Status type not found' });
    }
    res.json(row);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const { id } = req.params;
    const row = await customerStatusTypesApi.getById(id);
    if (!row) {
      return res.status(404).json({ error: 'Status type not found' });
    }
    res.json(row);
  } catch (err) {
    next(err);
  }
}

async function removeById(req, res, next) {
  try {
    const { id } = req.params;
    const hard = parseBoolOrNull(req.query.hard) === true;
    const result = await customerStatusTypesApi.removeById(id, { hard });
    if (!result.ok) {
      return res.status(404).json({ error: 'Status type not found' });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const { q, is_active, limit, offset, orderBy, order } = req.query;

    const filters = {
      q: q || undefined,
      is_active: parseBoolOrNull(is_active) ?? undefined,
      limit: parseIntOrNull(limit) ?? undefined,
      offset: parseIntOrNull(offset) ?? undefined,
      orderBy: orderBy || undefined,
      order: order || undefined,
    };

    const result = await customerStatusTypesApi.list(filters);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function search(req, res, next) {
  try {
    const { q, is_active, limit, offset } = req.query;

    const filters = {
      q: q || undefined,
      is_active: parseBoolOrNull(is_active) ?? true,
      limit: parseIntOrNull(limit) ?? undefined,
      offset: parseIntOrNull(offset) ?? undefined,
    };

    const result = await customerStatusTypesApi.search(filters);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export default {
  ensureTable,
  create,
  updateById,
  getById,
  removeById,
  list,
  search,
};
