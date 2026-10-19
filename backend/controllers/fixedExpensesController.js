// ╔══════════════════════════════════════════════════════════════════════╗
// ║ fixedExpensesController.js — REST Handlers (Despesas Fixas)         ║
/* ║ CONSART ERP — ESM, UUID, customer_id, filtros, paginação, ordenação ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

import { fixedExpensesApi } from '../repositories/fixedExpenses/fixedExpenses.index.js';

// Bootstrap idempotente (não quebra schema existente)
fixedExpensesApi.ensureTable()
  .then(() => console.log('[fixedExpenses] tabela ok'))
  .catch((err) => {
    console.error('[fixedExpenses] erro ao garantir tabela:', err);
  })

/* Util: padroniza respostas de erro */
function sendError(res, err, status = 400) {
  const msg = err?.message || 'Erro inesperado';
  return res.status(status).json({ ok: false, error: msg });
}

/* Util: normaliza querystring -> tipos esperados */
function parseListQuery(q = {}) {
  const {
    search,
    customer_id,
    report_name,
    date_from,
    date_to,
    orderBy = 'created_at DESC',
    limit = '20',
    offset = '0',
  } = q;

  return {
    search: search ? String(search) : undefined,
    customer_id: customer_id ? String(customer_id).trim() : undefined,
    report_name: report_name ? String(report_name) : undefined,
    date_from: date_from ?? undefined, // 'YYYY-MM-DD' ou ISO
    date_to: date_to ?? undefined,
    orderBy: String(orderBy),
    limit: Math.max(1, Math.min(200, Number(limit) || 20)),
    offset: Math.max(0, Number(offset) || 0),
  };
}

/* Validação mínima de payload (POST/PUT) */
function validateBody(body = {}, { partial = false } = {}) {
  const out = {};
  const errs = [];

  // customer_id (UUID string)
  if ('customer_id' in body) {
    out.customer_id = body.customer_id ? String(body.customer_id).trim() : null;
  }

  // report_name
  if ('report_name' in body) {
    out.report_name = String(body.report_name).trim();
    if (!out.report_name && !partial) errs.push('report_name é obrigatório');
  } else if (!partial) {
    errs.push('report_name é obrigatório');
  }

  // payload (jsonb)
  if ('payload' in body) {
    out.payload = body.payload;
  }

  if (errs.length) {
    const e = new Error(errs.join('; '));
    e.status = 422;
    throw e;
  }
  return out;
}

/* UUID param validator (simple) */
function getUuidParam(req, name = 'id') {
  const val = String(req.params[name] || '').trim();
  if (!val) {
    const e = new Error('ID inválido');
    e.status = 422;
    throw e;
  }
  return val;
}

export const fixedExpensesController = {
  /** GET /api/fixed-expenses */
  list: async (req, res) => {
    try {
      const opts = parseListQuery(req.query);
      const [rows, total] = await Promise.all([
        fixedExpensesApi.list(opts),
        fixedExpensesApi.count(opts),
      ]);
      res.json({ ok: true, data: rows, total, limit: opts.limit, offset: opts.offset });
    } catch (err) {
      sendError(res, err, err.status || 400);
    }
  },

  /** GET /api/fixed-expenses/count */
  count: async (req, res) => {
    try {
      const opts = parseListQuery(req.query);
      const total = await fixedExpensesApi.count(opts);
      res.json({ ok: true, total });
    } catch (err) {
      sendError(res, err, err.status || 400);
    }
  },

  /** GET /api/fixed-expenses/:id */
  getById: async (req, res) => {
    try {
      const id = getUuidParam(req, 'id');
      const row = await fixedExpensesApi.getById(id);
      if (!row) return sendError(res, new Error('Registro não encontrado'), 404);
      res.json({ ok: true, data: row });
    } catch (err) {
      sendError(res, err, err.status || 400);
    }
  },

  /** POST /api/fixed-expenses */
  create: async (req, res) => {
    try {
      const data = validateBody(req.body, { partial: false });
      const row = await fixedExpensesApi.create(data);
      res.status(201).json({ ok: true, data: row });
    } catch (err) {
      sendError(res, err, err.status || 400);
    }
  },

  /** PUT /api/fixed-expenses/:id */
  update: async (req, res) => {
    try {
      const id = getUuidParam(req, 'id');
      const data = validateBody(req.body, { partial: true });
      const row = await fixedExpensesApi.update(id, data);
      if (!row) return sendError(res, new Error('Registro não encontrado'), 404);
      res.json({ ok: true, data: row });
    } catch (err) {
      sendError(res, err, err.status || 400);
    }
  },

  /** DELETE /api/fixed-expenses/:id */
  remove: async (req, res) => {
    try {
      const id = getUuidParam(req, 'id');
      const ok = await fixedExpensesApi.remove(id);
      if (!ok) return sendError(res, new Error('Registro não encontrado'), 404);
      res.json({ ok: true, removed: true });
    } catch (err) {
      sendError(res, err, err.status || 400);
    }
  },

  /** POST /api/fixed-expenses/upsert */
  upsertByCustomerAndReport: async (req, res) => {
    try {
      const { customer_id, report_name, payload } = req.body || {};
      const row = await fixedExpensesApi.upsertByCustomerAndReport({
        customer_id,
        report_name,
        payload,
      });
      res.status(201).json({ ok: true, data: row });
    } catch (err) {
      sendError(res, err, err.status || 400);
    }
  },
};

export default fixedExpensesController;