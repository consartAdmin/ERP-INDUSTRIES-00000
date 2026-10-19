// ╔══════════════════════════════════════════════════════════════════════╗
// ║ gradesController.js — Controller REST para /api/grades               ║
// ║ CONSART ERP — ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import * as gradesApi from '../repositories/grades/grades.index.js';

function httpError(res, e, fallbackStatus = 500) {
  const status = Number(e?.statusCode || e?.status || fallbackStatus);
  return res.status(status).json({ ok: false, error: e?.message || 'Erro' });
}

export async function list(req, res) {
  try {
    const q = String(req.query.q || '').trim();

    const limit = Math.min(
      Math.max(Number(req.query.limit) || 50, 1),
      100
    );

    const offset = Math.max(
      Number(req.query.offset) || 0,
      0
    );

    let isActive;

    if (
      req.query.is_active !== undefined &&
      req.query.is_active !== ''
    ) {
      const status = String(req.query.is_active).toLowerCase();

      if (!['true', 'false'].includes(status)) {
        return res.status(400).json({
          ok: false,
          error: 'O parâmetro is_active deve ser true ou false.',
        });
      }

      isActive = status === 'true';
    }

    const data = await gradesApi.list({
      q,
      isActive,
      limit,
      offset,
    });

    return res.status(200).json({
      ok: true,
      ...data,
    });
  } catch (e) {
    console.error('ERRO AO LISTAR GRADES:', {
      message: e?.message,
      stack: e?.stack,
      code: e?.code,
      detail: e?.detail,
    });

    return httpError(res, e, 500);
  }
}

export async function getById(req, res) {
  try {
    const row = await gradesApi.getById(req.params.id);
    if (!row) return res.status(404).json({ ok: false, error: 'Not Found' });
    return res.json({ ok: true, data: row });
  } catch (e) {
    return httpError(res, e, 500);
  }
}

export async function create(req, res) {
  try {
    const row = await gradesApi.create(req.body || {});
    return res.status(201).json({ ok: true, data: row });
  } catch (e) {
    // 400/409 previstos no service
    return httpError(res, e, 400);
  }
}

export async function update(req, res) {
  try {
    const row = await gradesApi.update(req.params.id, req.body || {});
    if (!row) return res.status(404).json({ ok: false, error: 'Not Found' });
    return res.json({ ok: true, data: row });
  } catch (e) {
    return httpError(res, e, 400);
  }
}

export async function remove(req, res) {
  try {
    const hard = String(req.query.hard || '').toLowerCase() === 'true';
    const out = await gradesApi.remove(req.params.id, { hard });
    return res.json({ ok: true, ...out });
  } catch (e) {
    return httpError(res, e, 400);
  }
}
