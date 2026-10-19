// ╔══════════════════════════════════════════════════════════════════════╗
// ║ userEmailAccountsController.js — Controller userEmailAccounts       ║
// ║ CONSART ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../config/db.js';
import {
  getById,
  list,
  listByUserId,
  listByEmailAccountId,
  create,
  update,
  remove,
} from '../repositories/userEmailAccounts/userEmailAccounts.index.js';

const ok = (res, data = {}) => res.json({ ok: true, ...data });

const bad = (res, message = 'Erro', code = 400, extra = {}) =>
  res.status(code).json({ ok: false, message, ...extra });

function toIntOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

export async function listUserEmailAccounts(req, res) {
  try {
    const data = await list(pool, {
      q: req.query.q,
      user_id: req.query.user_id,
      email_account_id: req.query.email_account_id,
      is_default: req.query.is_default,
      can_read: req.query.can_read,
      can_send: req.query.can_send,
      page: req.query.page,
      pageSize: req.query.pageSize,
    });

    return ok(res, data);
  } catch (error) {
    console.error('[userEmailAccountsController.listUserEmailAccounts]', error);
    return bad(res, error.message || 'Error listing userEmailAccounts', 500);
  }
}

export async function getUserEmailAccountById(req, res) {
  try {
    const id = toIntOrNull(req.params.id);
    if (!id) return bad(res, 'Invalid id', 400);

    const item = await getById(pool, id);
    if (!item) return bad(res, 'Link not found', 404);

    return ok(res, { item });
  } catch (error) {
    console.error('[userEmailAccountsController.getUserEmailAccountById]', error);
    return bad(res, error.message || 'Error fetching userEmailAccount', 500);
  }
}

export async function getUserEmailAccountsByUser(req, res) {
  try {
    const userId = toIntOrNull(req.params.userId);
    if (!userId) return bad(res, 'Invalid userId', 400);

    const items = await listByUserId(pool, userId);
    return ok(res, { items });
  } catch (error) {
    console.error('[userEmailAccountsController.getUserEmailAccountsByUser]', error);
    return bad(res, error.message || 'Error fetching user email accounts', 500);
  }
}

export async function getUserEmailAccountsByEmailAccount(req, res) {
  try {
    const emailAccountId = toIntOrNull(req.params.emailAccountId);
    if (!emailAccountId) return bad(res, 'Invalid emailAccountId', 400);

    const items = await listByEmailAccountId(pool, emailAccountId);
    return ok(res, { items });
  } catch (error) {
    console.error('[userEmailAccountsController.getUserEmailAccountsByEmailAccount]', error);
    return bad(res, error.message || 'Error fetching account links', 500);
  }
}

export async function createUserEmailAccount(req, res) {
  try {
    const item = await create(pool, req.body || {});
    return res.status(201).json({ ok: true, item });
  } catch (error) {
    console.error('[userEmailAccountsController.createUserEmailAccount]', error);

    if (error.code === 'VALIDATION_ERROR') {
      return bad(res, 'Validation error', 400, { details: error.details || [] });
    }

    if (error.code === 'USER_NOT_FOUND') {
      return bad(res, error.message, 404);
    }

    if (error.code === 'EMAIL_ACCOUNT_NOT_FOUND') {
      return bad(res, error.message, 404);
    }

    if (error.code === 'DUPLICATE_LINK') {
      return bad(res, error.message, 409);
    }

    return bad(res, error.message || 'Error creating link', 500);
  }
}

export async function updateUserEmailAccount(req, res) {
  try {
    const id = toIntOrNull(req.params.id);
    if (!id) return bad(res, 'Invalid id', 400);

    const item = await update(pool, id, req.body || {});
    if (!item) return bad(res, 'Link not found', 404);

    return ok(res, { item });
  } catch (error) {
    console.error('[userEmailAccountsController.updateUserEmailAccount]', error);

    if (error.code === 'VALIDATION_ERROR') {
      return bad(res, 'Validation error', 400, { details: error.details || [] });
    }

    if (error.code === 'USER_NOT_FOUND') {
      return bad(res, error.message, 404);
    }

    if (error.code === 'EMAIL_ACCOUNT_NOT_FOUND') {
      return bad(res, error.message, 404);
    }

    if (error.code === 'DUPLICATE_LINK') {
      return bad(res, error.message, 409);
    }

    return bad(res, error.message || 'Error updating link', 500);
  }
}

export async function deleteUserEmailAccount(req, res) {
  try {
    const id = toIntOrNull(req.params.id);
    if (!id) return bad(res, 'Invalid id', 400);

    const deleted = await remove(pool, id);
    if (!deleted) return bad(res, 'Link not found', 404);

    return ok(res, { deleted: true });
  } catch (error) {
    console.error('[userEmailAccountsController.deleteUserEmailAccount]', error);
    return bad(res, error.message || 'Error deleting link', 500);
  }
}