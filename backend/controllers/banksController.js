// ╔══════════════════════════════════════════════════════════════════════╗
// ║ banksController.js — Controller REST de bancos                     ║
// ║ CONSART ERP | /api/banks                                           ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  listBanks,
  getBankById,
  createBank,
  updateBank,
  deactivateBank,
} from '../repositories/banks/banks.index.js';

function sendError(res, error, context) {
  console.error(`[${context}]`, error);
  const pgStatus = error?.code === '23505' ? 409 : error?.code === '23503' ? 409 : null;
  const status = Number(error?.statusCode) || pgStatus || 500;
  const message = error?.code === '23505'
    ? 'Já existe um banco com este nome ou código.'
    : error?.code === '23503'
      ? 'O banco possui vínculos e não pode ser alterado desta forma.'
      : error?.message || 'Erro interno ao processar bancos.';
  return res.status(status).json({ ok: false, message });
}

export async function list(req, res) {
  try {
    const data = await listBanks(req.query || {});
    return res.json({ ok: true, data, total: data.length });
  } catch (error) { return sendError(res, error, 'BANKS/LIST'); }
}

export async function getOne(req, res) {
  try {
    const data = await getBankById(req.params.id);
    if (!data) return res.status(404).json({ ok: false, message: 'Banco não encontrado.' });
    return res.json({ ok: true, data });
  } catch (error) { return sendError(res, error, 'BANKS/GET'); }
}

export async function create(req, res) {
  try {
    const data = await createBank(req.body || {});
    return res.status(201).json({ ok: true, message: 'Banco criado com sucesso.', data });
  } catch (error) { return sendError(res, error, 'BANKS/CREATE'); }
}

export async function update(req, res) {
  try {
    const data = await updateBank(req.params.id, req.body || {});
    if (!data) return res.status(404).json({ ok: false, message: 'Banco não encontrado.' });
    return res.json({ ok: true, message: 'Banco atualizado com sucesso.', data });
  } catch (error) { return sendError(res, error, 'BANKS/UPDATE'); }
}

export async function remove(req, res) {
  try {
    const data = await deactivateBank(req.params.id);
    if (!data) return res.status(404).json({ ok: false, message: 'Banco não encontrado.' });
    return res.json({ ok: true, message: 'Banco desativado com sucesso.', data });
  } catch (error) { return sendError(res, error, 'BANKS/DELETE'); }
}
