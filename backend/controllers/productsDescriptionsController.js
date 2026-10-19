// ╔══════════════════════════════════════════════════════════════╗
// ║ productsDescriptionsController.js — CONSART ERP (ESM)       ║
// ╚══════════════════════════════════════════════════════════════╝

'use strict';

import * as api from '../repositories/productsDescriptions/productsDescriptions.index.js';

function sendError(res, err, fallbackMsg) {
  const status = err?.status || 500;
  const msg = err?.message || fallbackMsg || 'Erro inesperado';
  if (status >= 500) console.error('[productsDescriptions]', err);
  return res.status(status).json({ error: msg });
}

export async function list(req, res) {
  try {
    const rows = await api.list(req.query);
    return res.json(rows);
  } catch (err) {
    return sendError(res, err, 'Erro ao listar descrições');
  }
}

export async function getById(req, res) {
  try {
    const row = await api.getById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Descrição não encontrada' });
    return res.json(row);
  } catch (err) {
    return sendError(res, err, 'Erro ao buscar descrição');
  }
}

export async function create(req, res) {
  try {
    const row = await api.create(req.body);
    return res.status(201).json(row);
  } catch (err) {
    return sendError(res, err, 'Erro ao criar descrição');
  }
}

export async function update(req, res) {
  try {
    const row = await api.update(req.params.id, req.body);
    if (!row) return res.status(404).json({ error: 'Descrição não encontrada' });
    return res.json(row);
  } catch (err) {
    return sendError(res, err, 'Erro ao atualizar descrição');
  }
}

export async function deactivate(req, res) {
  try {
    const row = await api.deactivate(req.params.id);
    if (!row) return res.status(404).json({ error: 'Descrição não encontrada' });
    return res.json({ success: true, data: row });
  } catch (err) {
    return sendError(res, err, 'Erro ao desativar descrição');
  }
}

export async function remove(req, res) {
  try {
    await api.remove(req.params.id);
    return res.json({ success: true });
  } catch (err) {
    return sendError(res, err, 'Erro ao remover descrição');
  }
}
