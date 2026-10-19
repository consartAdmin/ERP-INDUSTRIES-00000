// ╔══════════════════════════════════════════════════════════════════════╗
// ║ bankAccountsController.js — Controller REST de contas bancárias    ║
// ║ CONSART ERP | /api/bank-accounts                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  listBankAccounts,
  getBankAccountById,
  createBankAccount,
  updateBankAccount,
  deactivateBankAccount,
} from '../repositories/bankAccounts/bankAccounts.index.js';

function sendError(res, error, context) {
  console.error(`[${context}]`, error);
  const pgStatus = ['23505', '23503', '23514'].includes(error?.code) ? 409 : null;
  const status = Number(error?.statusCode) || pgStatus || 500;
  const message = error?.code === '23505'
    ? 'Já existe uma conta bancária com este nome.'
    : error?.code === '23503'
      ? 'O banco informado não existe ou a conta possui vínculos.'
      : error?.code === '23514'
        ? 'Provedor ou modo de boleto inválido.'
        : error?.message || 'Erro interno ao processar contas bancárias.';
  return res.status(status).json({ ok: false, message });
}

export async function list(req, res) {
  try {
    const data = await listBankAccounts(req.query || {});
    return res.json({ ok: true, data, total: data.length });
  } catch (error) { return sendError(res, error, 'BANK-ACCOUNTS/LIST'); }
}

export async function getOne(req, res) {
  try {
    const data = await getBankAccountById(req.params.id);
    if (!data) return res.status(404).json({ ok: false, message: 'Conta bancária não encontrada.' });
    return res.json({ ok: true, data });
  } catch (error) { return sendError(res, error, 'BANK-ACCOUNTS/GET'); }
}

export async function create(req, res) {
  try {
    const data = await createBankAccount(req.body || {});
    return res.status(201).json({ ok: true, message: 'Conta bancária criada com sucesso.', data });
  } catch (error) { return sendError(res, error, 'BANK-ACCOUNTS/CREATE'); }
}

export async function update(req, res) {
  try {
    const data = await updateBankAccount(req.params.id, req.body || {});
    if (!data) return res.status(404).json({ ok: false, message: 'Conta bancária não encontrada.' });
    return res.json({ ok: true, message: 'Conta bancária atualizada com sucesso.', data });
  } catch (error) { return sendError(res, error, 'BANK-ACCOUNTS/UPDATE'); }
}

export async function remove(req, res) {
  try {
    const data = await deactivateBankAccount(req.params.id);
    if (!data) return res.status(404).json({ ok: false, message: 'Conta bancária não encontrada.' });
    return res.json({ ok: true, message: 'Conta bancária desativada com sucesso.', data });
  } catch (error) { return sendError(res, error, 'BANK-ACCOUNTS/DELETE'); }
}
