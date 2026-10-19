/* ╔══════════════════════════════════════════════════════════════════════╗
 * ║ plano_acaoController.js — Controller Plano de Ação | CONSART (ESM)   ║
 * ║ Path: backend/controllers/plano_acaoController.js                    ║
 * ║ - Valida entrada, chama DAL, padroniza respostas                      ║
 * ╚══════════════════════════════════════════════════════════════════════╝ */

import * as api from '../repositories/plano_acao/plano_acao.index.js';

// ======================================================================
// Helpers
// ======================================================================
function getReqId(req) {
  return req.id || req.reqId || req.headers['x-request-id'] || null;
}

function sendError(res, err, reqId = null) {
  const status = err.statusCode || err.status || 500;

  const payload = {
    ok: false,
    error: err.message || 'Erro interno.',
  };
  if (reqId) payload.reqId = reqId;

  // Detalhes úteis em DEV (sem vazar em produção, se você quiser)
  if (process.env.NODE_ENV !== 'production' && err.code) payload.code = err.code;

  return res.status(status).json(payload);
}

// ======================================================================
// Handlers
// ======================================================================
export async function list(req, res) {
  const reqId = getReqId(req);
  try {
    const data = await api.list(req.query || {});
    return res.json({ ok: true, reqId, ...data });
  } catch (err) {
    return sendError(res, err, reqId);
  }
}

export async function getById(req, res) {
  const reqId = getReqId(req);
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ ok: false, reqId, error: 'ID inválido.' });

    const row = await api.getById(id);
    if (!row) return res.status(404).json({ ok: false, reqId, error: 'Registro não encontrado.' });

    return res.json({ ok: true, reqId, row });
  } catch (err) {
    return sendError(res, err, reqId);
  }
}

export async function create(req, res) {
  const reqId = getReqId(req);
  try {
    const row = await api.create(req.body || {});
    return res.status(201).json({ ok: true, reqId, row });
  } catch (err) {
    return sendError(res, err, reqId);
  }
}

export async function update(req, res) {
  const reqId = getReqId(req);
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ ok: false, reqId, error: 'ID inválido.' });

    const row = await api.updateById(id, req.body || {});
    if (!row) return res.status(404).json({ ok: false, reqId, error: 'Registro não encontrado.' });

    return res.json({ ok: true, reqId, row });
  } catch (err) {
    return sendError(res, err, reqId);
  }
}

export async function remove(req, res) {
  const reqId = getReqId(req);
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ ok: false, reqId, error: 'ID inválido.' });

    const removedId = await api.removeById(id);
    if (!removedId) return res.status(404).json({ ok: false, reqId, error: 'Registro não encontrado.' });

    return res.json({ ok: true, reqId, id: removedId });
  } catch (err) {
    return sendError(res, err, reqId);
  }
}

export async function bulkUpsert(req, res) {
  const reqId = getReqId(req);
  try {
    const rows = await api.bulkUpsert(req.body || []);
    return res.json({ ok: true, reqId, rows, count: rows.length });
  } catch (err) {
    return sendError(res, err, reqId);
  }
}
