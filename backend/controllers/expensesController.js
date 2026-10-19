// ╔══════════════════════════════════════════════════════════════════════╗
// ║ expensesController.js — Controller (Express)                         ║
// ║ Rotas: /api/expenses                                                 ║
// ║ CONSART ERP | ESM                                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  listExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  patchExpenseStatus,
  deleteExpense,
} from '../repositories/expenses/expenses.index.js';

import { generateExpensesPdf } from '../generationPdf/generateExpensesPdf.js'; // ✅ ajuste path se preciso

function badRequest(res, msg, extra = {}) {
  return res.status(400).json({ ok: false, message: msg, ...extra });
}

function serverError(res, err, where = '') {
  console.error('[expensesController]', where, err);
  return res.status(500).json({ ok: false, message: 'Internal server error' });
}

function requireFields(body, fields = []) {
  for (const f of fields) {
    if (body?.[f] === undefined || body?.[f] === null || body?.[f] === '') {
      return f;
    }
  }
  return null;
}

/* ──────────────────────────────────────────────────────────────
   GET /api/expenses  (list + total + total_value)
────────────────────────────────────────────────────────────── */
export async function getExpenses(req, res) {
  try {
    const data = await listExpenses(req.query);
    return res.json({
      ok: true,
      total: data.total,
      total_value: data.total_value,
      rows: data.rows,
      limit: data.limit,
      offset: data.offset,
    });
  } catch (err) {
    return serverError(res, err, 'getExpenses');
  }
}

/* ──────────────────────────────────────────────────────────────
   GET /api/expenses/:id
────────────────────────────────────────────────────────────── */
export async function getExpense(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return badRequest(res, 'Invalid id');

    const row = await getExpenseById(id);
    if (!row) return res.status(404).json({ ok: false, message: 'Not found' });

    return res.json({ ok: true, row });
  } catch (err) {
    return serverError(res, err, 'getExpense');
  }
}

/* ──────────────────────────────────────────────────────────────
   POST /api/expenses   (returns expense_id auto)
────────────────────────────────────────────────────────────── */
export async function createExpenseHandler(req, res) {
  try {
    const missing = requireFields(req.body, ['name', 'value', 'due_date']);
    if (missing) return badRequest(res, `Missing field: ${missing}`);

    const created = await createExpense(req.body);

    // ✅ IMPORTANT: return expense_id to frontend
    return res.status(201).json({
      ok: true,
      id: created.id,
      expense_id: created.expense_id,
    });
  } catch (err) {
    if (err?.code === '23505') {
      return res.status(409).json({ ok: false, message: 'Duplicate expense_id (unique)' });
    }
    if (err?.code === '23514') {
      return res.status(400).json({ ok: false, message: 'Validation failed (check constraint)' });
    }
    return serverError(res, err, 'createExpenseHandler');
  }
}

/* ──────────────────────────────────────────────────────────────
   PUT /api/expenses/:id
────────────────────────────────────────────────────────────── */
export async function updateExpenseHandler(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return badRequest(res, 'Invalid id');

    const missing = requireFields(req.body, ['name', 'value', 'due_date']);
    if (missing) return badRequest(res, `Missing field: ${missing}`);

    const updated = await updateExpense(id, req.body);
    if (!updated) return res.status(404).json({ ok: false, message: 'Not found' });

    return res.json({
      ok: true,
      id: updated.id,
      expense_id: updated.expense_id,
    });
  } catch (err) {
    if (err?.code === '23505') {
      return res.status(409).json({ ok: false, message: 'Duplicate expense_id (unique)' });
    }
    if (err?.code === '23514') {
      return res.status(400).json({ ok: false, message: 'Validation failed (check constraint)' });
    }
    return serverError(res, err, 'updateExpenseHandler');
  }
}

/* ──────────────────────────────────────────────────────────────
   PATCH /api/expenses/:id/status
────────────────────────────────────────────────────────────── */
export async function patchExpenseStatusHandler(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return badRequest(res, 'Invalid id');

    const missing = requireFields(req.body, ['status']);
    if (missing) return badRequest(res, `Missing field: ${missing}`);

    const updated = await patchExpenseStatus(id, req.body);
    if (!updated) return res.status(404).json({ ok: false, message: 'Not found' });

    return res.json({ ok: true, id: updated.id });
  } catch (err) {
    if (err?.code === '23514') {
      return res.status(400).json({ ok: false, message: 'Invalid status (check constraint)' });
    }
    return serverError(res, err, 'patchExpenseStatusHandler');
  }
}

/* ──────────────────────────────────────────────────────────────
   DELETE /api/expenses/:id
────────────────────────────────────────────────────────────── */
export async function deleteExpenseHandler(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return badRequest(res, 'Invalid id');

    const deleted = await deleteExpense(id);
    if (!deleted) return res.status(404).json({ ok: false, message: 'Not found' });

    return res.json({ ok: true, id: deleted.id });
  } catch (err) {
    return serverError(res, err, 'deleteExpenseHandler');
  }
}

export async function getExpensesPdf(req, res) {
  try {
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    const filters = {
      q: req.query.q,
      name: req.query.name,
      status: req.query.status,
      category: req.query.category,
      vendor: req.query.vendor,
      date_from: req.query.date_from,
      date_to: req.query.date_to,
      order_by: req.query.order_by || 'created_at_desc',
      limit: req.query.limit ? Number(req.query.limit) : 2000,
    };

    const out = await generateExpensesPdf({ filters, baseUrl });

    // ✅ força DOWNLOAD do arquivo
    return res.download(out.filePath, out.filename);
  } catch (err) {
    console.error('[expensesController] getExpensesPdf', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
}