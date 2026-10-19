/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ FILE: chartOfAccountsController.js                                  ║
   ║ MODULE: Chart Of Accounts                                           ║
   ║ DESCRIPTION: Controller for public."chartOfAccounts"                ║
   ║ CONSART ERP · Express · ESM                                         ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

'use strict';

import chartOfAccountsApi from '../repositories/chartOfAccounts/chartOfAccounts.index.js';

function parseBoolean(value, fallback = undefined) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;

  const v = String(value).trim().toLowerCase();

  if (['true', '1', 'yes', 'y'].includes(v)) return true;
  if (['false', '0', 'no', 'n'].includes(v)) return false;

  return fallback;
}

function sendError(res, error, fallbackMessage = 'Internal server error') {
  const status = Number(error?.status) || 500;
  const message = error?.message || fallbackMessage;

  return res.status(status).json({
    ok: false,
    message,
  });
}

async function ensureReady(_req, _res, next) {
  try {
    await chartOfAccountsApi.ensureTable();
    return next();
  } catch (error) {
    return next(error);
  }
}

async function listAccounts(req, res) {
  try {
    const result = await chartOfAccountsApi.list({
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search ?? req.query.q ?? '',
      account_type: req.query.account_type ?? '',
      nature: req.query.nature ?? '',
      parent_account_id: req.query.parent_account_id ?? '',
      allows_posting: req.query.allows_posting ?? '',
      is_active: req.query.is_active ?? req.query.isActive ?? '',
      only_posting: req.query.only_posting ?? req.query.onlyPosting ?? '',
      sort_by: req.query.sort_by ?? 'code',
      sort_order: req.query.sort_order ?? 'asc',
    });

    return res.status(200).json({
      ok: true,
      ...result,
    });
  } catch (error) {
    return sendError(res, error, 'Failed to list chart of accounts');
  }
}

async function searchAccounts(req, res) {
  try {
    const q = req.query.q ?? req.query.search ?? '';
    const limit = req.query.limit ?? 20;

    const rows = await chartOfAccountsApi.search(q, limit);

    return res.status(200).json({
      ok: true,
      data: rows,
      total: rows.length,
    });
  } catch (error) {
    return sendError(res, error, 'Failed to search chart of accounts');
  }
}

async function listPostingAccounts(req, res) {
  try {
    const rows = await chartOfAccountsApi.listPostingAccounts({
      is_active: parseBoolean(req.query.is_active, true),
      search: req.query.search ?? req.query.q ?? '',
      limit: req.query.limit ?? 100,
    });

    return res.status(200).json({
      ok: true,
      data: rows,
      total: rows.length,
    });
  } catch (error) {
    return sendError(res, error, 'Failed to list posting accounts');
  }
}

async function getAccountById(req, res) {
  try {
    const row = await chartOfAccountsApi.getById(req.params.id);

    if (!row) {
      return res.status(404).json({
        ok: false,
        message: 'ACCOUNT_NOT_FOUND',
      });
    }

    return res.status(200).json({
      ok: true,
      data: row,
    });
  } catch (error) {
    return sendError(res, error, 'Failed to get account');
  }
}

async function getAccountByCode(req, res) {
  try {
    const row = await chartOfAccountsApi.getByCode(req.params.code);

    if (!row) {
      return res.status(404).json({
        ok: false,
        message: 'ACCOUNT_NOT_FOUND',
      });
    }

    return res.status(200).json({
      ok: true,
      data: row,
    });
  } catch (error) {
    return sendError(res, error, 'Failed to get account by code');
  }
}

async function createAccount(req, res) {
  try {
    const created = await chartOfAccountsApi.create({
      code: req.body?.code,
      description: req.body?.description,
      account_type: req.body?.account_type,
      nature: req.body?.nature,
      level: req.body?.level,
      parent_account_id: req.body?.parent_account_id,
      allows_posting: req.body?.allows_posting,
      is_active: req.body?.is_active,
      notes: req.body?.notes,
    });

    return res.status(201).json({
      ok: true,
      message: 'ACCOUNT_CREATED',
      data: created,
    });
  } catch (error) {
    return sendError(res, error, 'Failed to create account');
  }
}

async function updateAccount(req, res) {
  try {
    const updated = await chartOfAccountsApi.update(req.params.id, {
      code: req.body?.code,
      description: req.body?.description,
      account_type: req.body?.account_type,
      nature: req.body?.nature,
      level: req.body?.level,
      parent_account_id: req.body?.parent_account_id,
      allows_posting: req.body?.allows_posting,
      is_active: req.body?.is_active,
      notes: req.body?.notes,
    });

    return res.status(200).json({
      ok: true,
      message: 'ACCOUNT_UPDATED',
      data: updated,
    });
  } catch (error) {
    return sendError(res, error, 'Failed to update account');
  }
}

async function deleteAccount(req, res) {
  try {
    const hardDelete = parseBoolean(req.query.hard_delete, false) === true
      || parseBoolean(req.body?.hard_delete, false) === true;

    const result = await chartOfAccountsApi.remove(req.params.id, { hardDelete });

    return res.status(200).json({
      ok: true,
      message: result.mode === 'hard' ? 'ACCOUNT_DELETED' : 'ACCOUNT_DEACTIVATED',
      ...result,
    });
  } catch (error) {
    return sendError(res, error, 'Failed to delete account');
  }
}

async function activateAccount(req, res) {
  try {
    const updated = await chartOfAccountsApi.setActive(req.params.id, true);

    return res.status(200).json({
      ok: true,
      message: 'ACCOUNT_ACTIVATED',
      data: updated,
    });
  } catch (error) {
    return sendError(res, error, 'Failed to activate account');
  }
}

async function deactivateAccount(req, res) {
  try {
    const updated = await chartOfAccountsApi.setActive(req.params.id, false);

    return res.status(200).json({
      ok: true,
      message: 'ACCOUNT_DEACTIVATED',
      data: updated,
    });
  } catch (error) {
    return sendError(res, error, 'Failed to deactivate account');
  }
}

async function setAccountActiveState(req, res) {
  try {
    const isActive = parseBoolean(req.body?.is_active, undefined);

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        ok: false,
        message: 'INVALID_IS_ACTIVE',
      });
    }

    const updated = await chartOfAccountsApi.setActive(req.params.id, isActive);

    return res.status(200).json({
      ok: true,
      message: isActive ? 'ACCOUNT_ACTIVATED' : 'ACCOUNT_DEACTIVATED',
      data: updated,
    });
  } catch (error) {
    return sendError(res, error, 'Failed to update active state');
  }
}

async function getTree(req, res) {
  try {
    const rows = await chartOfAccountsApi.getTree({
      is_active: parseBoolean(req.query.is_active, null),
    });

    return res.status(200).json({
      ok: true,
      data: rows,
    });
  } catch (error) {
    return sendError(res, error, 'Failed to load account tree');
  }
}

async function getFlatHierarchy(req, res) {
  try {
    const rows = await chartOfAccountsApi.getFlatHierarchy({
      is_active: parseBoolean(req.query.is_active, null),
    });

    return res.status(200).json({
      ok: true,
      data: rows,
      total: rows.length,
    });
  } catch (error) {
    return sendError(res, error, 'Failed to load flat hierarchy');
  }
}

const chartOfAccountsController = {
  ensureReady,
  listAccounts,
  searchAccounts,
  listPostingAccounts,
  getAccountById,
  getAccountByCode,
  createAccount,
  updateAccount,
  deleteAccount,
  activateAccount,
  deactivateAccount,
  setAccountActiveState,
  getTree,
  getFlatHierarchy,
};

export default chartOfAccountsController;

export {
  ensureReady,
  listAccounts,
  searchAccounts,
  listPostingAccounts,
  getAccountById,
  getAccountByCode,
  createAccount,
  updateAccount,
  deleteAccount,
  activateAccount,
  deactivateAccount,
  setAccountActiveState,
  getTree,
  getFlatHierarchy,
};