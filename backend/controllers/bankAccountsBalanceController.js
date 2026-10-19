// ╔══════════════════════════════════════════════════════════════════════╗
// ║ bankAccountsBalanceController.js — Saldos / Conferências Bancárias   ║
// ║ CONSART ERP | /api/bank-accounts-balance                             ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  calculateBalance,
  getSummary,
  listCheckpoints,
  getCheckpointById,
  createCheckpoint,
  updateCheckpoint,
  deleteCheckpoint,
} from '../repositories/bankAccountsBalance/bankAccountsBalance.index.js';

function sendError(res, error, context) {
  console.error(`[${context}]`, error);
  const status = Number(error?.statusCode)
    || (error?.code === '23505' || error?.code === '23503' ? 409 : 500);
  const message = error?.code === '23505'
    ? 'Já existe uma conferência para esta conta nesta data.'
    : error?.code === '23503'
      ? 'A conta bancária informada não existe.'
      : error?.message || 'Erro interno ao processar saldos bancários.';
  return res.status(status).json({ ok: false, message });
}

function currentUserName(req) {
  const u = req.user || {};
  return u.name || u.payload?.username || u.payload?.email
    || (u.user_id ? `Usuário #${u.user_id}` : null);
}

// GET /api/bank-accounts-balance/summary
export async function summary(req, res) {
  try {
    const data = await getSummary(req.query || {});
    return res.json({ ok: true, data });
  } catch (error) { return sendError(res, error, 'BANK-ACCOUNTS-BALANCE/SUMMARY'); }
}

// GET /api/bank-accounts-balance/calculate?bank_account_id=&date=
export async function calculate(req, res) {
  try {
    const { bank_account_id: accountId, date, exclude_id: excludeId } = req.query || {};
    const data = await calculateBalance(accountId, date, {
      beforeDate: true,
      excludeId: excludeId ? Number(excludeId) : null,
    });
    return res.json({ ok: true, data });
  } catch (error) { return sendError(res, error, 'BANK-ACCOUNTS-BALANCE/CALCULATE'); }
}

// GET /api/bank-accounts-balance
export async function list(req, res) {
  try {
    const { bank_account_id: bankAccountId, from, to, limit } = req.query || {};
    const data = await listCheckpoints({ bankAccountId, from, to, limit });
    return res.json({ ok: true, data, total: data.length });
  } catch (error) { return sendError(res, error, 'BANK-ACCOUNTS-BALANCE/LIST'); }
}

export async function getOne(req, res) {
  try {
    const data = await getCheckpointById(req.params.id);
    if (!data) return res.status(404).json({ ok: false, message: 'Conferência não encontrada.' });
    return res.json({ ok: true, data });
  } catch (error) { return sendError(res, error, 'BANK-ACCOUNTS-BALANCE/GET'); }
}

export async function create(req, res) {
  try {
    const data = await createCheckpoint(req.body || {}, { user: currentUserName(req) });
    return res.status(201).json({ ok: true, message: 'Conferência de saldo registrada.', data });
  } catch (error) { return sendError(res, error, 'BANK-ACCOUNTS-BALANCE/CREATE'); }
}

export async function update(req, res) {
  try {
    const data = await updateCheckpoint(req.params.id, req.body || {});
    if (!data) return res.status(404).json({ ok: false, message: 'Conferência não encontrada.' });
    return res.json({ ok: true, message: 'Conferência de saldo atualizada.', data });
  } catch (error) { return sendError(res, error, 'BANK-ACCOUNTS-BALANCE/UPDATE'); }
}

export async function remove(req, res) {
  try {
    const data = await deleteCheckpoint(req.params.id);
    if (!data) return res.status(404).json({ ok: false, message: 'Conferência não encontrada.' });
    return res.json({ ok: true, message: 'Conferência de saldo excluída.', data });
  } catch (error) { return sendError(res, error, 'BANK-ACCOUNTS-BALANCE/DELETE'); }
}
