// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerStatusController.js — Customer Status Atual (ERP)         ║
// ║ Usa customerStatusApi (UPSERT por customer_id)                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import * as customerStatusApi from '../repositories/customerStatus/customerStatus.index.js';

const parseIntOrNull = (v) => {
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
};

async function ensureTable(req, res, next) {
  try {
    const result = await customerStatusApi.ensureTable();
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * Define ou atualiza o status de um cliente.
 * Body esperado:
 * {
 *   customer_id,
 *   status_type_id,
 *   note?,
 *   updated_by?
 * }
 */
async function setStatus(req, res, next) {
  try {
    const { customer_id, status_type_id, note, updated_by } = req.body || {};

    const cid = parseIntOrNull(customer_id);
    const stid = parseIntOrNull(status_type_id);

    if (!cid) {
      return res.status(400).json({ error: 'customer_id is required and must be integer' });
    }
    if (!stid) {
      return res.status(400).json({ error: 'status_type_id is required and must be integer' });
    }

    const row = await customerStatusApi.setStatusForCustomer(cid, stid, {
      note,
      updated_by: parseIntOrNull(updated_by),
    });

    res.status(200).json(row);
  } catch (err) {
    next(err);
  }
}

/** GET status atual de um cliente */
async function getByCustomer(req, res, next) {
  try {
    const { customerId } = req.params;
    const cid = parseIntOrNull(customerId);
    if (!cid) {
      return res.status(400).json({ error: 'invalid customerId' });
    }

    const row = await customerStatusApi.getByCustomerId(cid);
    if (!row) {
      return res.status(404).json({ error: 'Status for this customer not found' });
    }
    res.json(row);
  } catch (err) {
    next(err);
  }
}

/** UPDATE por id do registro de status (não muda customer_id) */
async function updateById(req, res, next) {
  try {
    const { id } = req.params;
    const payload = req.body || {};

    const row = await customerStatusApi.updateById(id, payload);
    if (!row) {
      return res.status(404).json({ error: 'customerStatus not found' });
    }
    res.json(row);
  } catch (err) {
    next(err);
  }
}

/** DELETE vínculo de status por customerId */
async function removeByCustomer(req, res, next) {
  try {
    const { customerId } = req.params;
    const cid = parseIntOrNull(customerId);
    if (!cid) {
      return res.status(400).json({ error: 'invalid customerId' });
    }

    const result = await customerStatusApi.removeByCustomerId(cid);
    if (!result.ok) {
      return res.status(404).json({ error: 'Status for this customer not found' });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * LIST com join em customerStatusTypes
 * Query params:
 *  - status_type_id
 *  - limit
 *  - offset
 *  - orderBy
 *  - order
 */
async function list(req, res, next) {
  try {
    const { status_type_id, limit, offset, orderBy, order } = req.query;

    const filters = {
      status_type_id: status_type_id ? parseIntOrNull(status_type_id) : undefined,
      limit: limit ? parseIntOrNull(limit) : undefined,
      offset: offset ? parseIntOrNull(offset) : undefined,
      orderBy: orderBy || undefined,
      order: order || undefined,
    };

    const result = await customerStatusApi.list(filters);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/** GET by id — se precisar acessar direto o registro de status */
async function getById(req, res, next) {
  try {
    const { id } = req.params;
    const row = await customerStatusApi.getById(id);
    if (!row) {
      return res.status(404).json({ error: 'customerStatus not found' });
    }
    res.json(row);
  } catch (err) {
    next(err);
  }
}

export default {
  ensureTable,
  setStatus,
  getByCustomer,
  updateById,
  removeByCustomer,
  list,
  getById,
};
