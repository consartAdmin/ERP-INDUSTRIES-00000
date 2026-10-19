// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║ File: backend/controllers/sessionTimeOutConfigController.js                  ║
// ║ Desc: Controller para gerir a tabela sessionTimeOutConfig (GET / PUT)        ║
// ║ Padrão: ESM — usa pool direto do db.js                                         ║
// ║ Autor: Renato / Atlas (CONSART ERP)                                           ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

import pool from '../config/db.js'; // importando pool diretamente

// Campos permitidos / defaults (espelho do schema)
const DEFAULTS = {
  id: 1,
  enabled: true,
  idle_minutes: 10,
  warn_seconds: 0,
  silent: true,
  redirect_url: '/public/login/login.html'
};

// Helper de validação simples
const normalizeBoolean = (v) => {
  if (v === true || v === 'true' || v === 1 || v === '1') return true;
  if (v === false || v === 'false' || v === 0 || v === '0') return false;
  return null;
};
const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : NaN;
};

/**
 * GET /api/session-config
 */
export async function getSessionConfig(req, res) {
  try {
    const sql = `SELECT id, enabled, idle_minutes, warn_seconds, silent, redirect_url, updated_by, updated_at
                 FROM "sessionTimeOutConfig" WHERE id = $1`;
    const { rows } = await pool.query(sql, [1]);

    if (!rows || rows.length === 0) {
      return res.status(200).json({ ...DEFAULTS });
    }

    const row = rows[0];
    return res.status(200).json({
      id: row.id,
      enabled: !!row.enabled,
      idle_minutes: Number(row.idle_minutes),
      warn_seconds: Number(row.warn_seconds),
      silent: !!row.silent,
      redirect_url: row.redirect_url || DEFAULTS.redirect_url,
      updated_by: row.updated_by || null,
      updated_at: row.updated_at || null
    });
  } catch (err) {
    console.error('[sessionTimeOutConfigController.get] erro', err);
    return res.status(500).json({ ok: false, error: 'Erro interno ao buscar configuração.' });
  }
}

/**
 * PUT /api/session-config
 */
export async function updateSessionConfig(req, res) {
  try {
    const body = req.body || {};
    const next = {};

    if (Object.prototype.hasOwnProperty.call(body, 'enabled')) {
      const bv = normalizeBoolean(body.enabled);
      if (bv === null) return res.status(400).json({ ok: false, error: 'Campo "enabled" inválido.' });
      next.enabled = bv;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'idle_minutes')) {
      const iv = toInt(body.idle_minutes);
      if (!Number.isFinite(iv) || iv < 1) {
        return res.status(400).json({ ok: false, error: 'Campo "idle_minutes" inválido.' });
      }
      next.idle_minutes = iv;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'warn_seconds')) {
      const wv = toInt(body.warn_seconds);
      if (!Number.isFinite(wv) || wv < 0) {
        return res.status(400).json({ ok: false, error: 'Campo "warn_seconds" inválido.' });
      }
      next.warn_seconds = wv;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'silent')) {
      const sv = normalizeBoolean(body.silent);
      if (sv === null) return res.status(400).json({ ok: false, error: 'Campo "silent" inválido.' });
      next.silent = sv;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'redirect_url')) {
      const ru = String(body.redirect_url || '').trim();
      if (ru.length === 0) return res.status(400).json({ ok: false, error: 'Campo "redirect_url" inválido.' });
      next.redirect_url = ru;
    }

    let updated_by = null;
    if (Object.prototype.hasOwnProperty.call(body, 'updated_by')) {
      updated_by = body.updated_by ? String(body.updated_by).trim() : null;
    } else if (req.user && req.user.username) {
      updated_by = req.user.username;
    }

    if (Object.keys(next).length === 0 && updated_by == null) {
      return res.status(400).json({ ok: false, error: 'Nenhum campo para atualizar.' });
    }

    const fields = [];
    const params = [1]; // id sempre 1
    let idx = 2;

    for (const [key, val] of Object.entries(next)) {
      fields.push({ key, val });
      params.push(val);
      idx++;
    }
    if (updated_by != null) {
      fields.push({ key: 'updated_by', val: updated_by });
      params.push(updated_by);
    }

    const insertCols = ['id', ...fields.map(f => f.key)];
    const insertVals = fields.map((_, i) => `$${i + 2}`);
    insertVals.unshift('$1'); // id

    const updateAssignments = fields.map(f => `${f.key} = EXCLUDED.${f.key}`);
    const sql = `
      INSERT INTO "sessionTimeOutConfig" (${insertCols.join(', ')})
      VALUES (${insertVals.join(', ')})
      ON CONFLICT (id) DO UPDATE SET
        ${updateAssignments.join(', ')}, updated_at = now()
      RETURNING id, enabled, idle_minutes, warn_seconds, silent, redirect_url, updated_by, updated_at;
    `;

    const { rows } = await pool.query(sql, params);
    const saved = rows[0];
    if (!saved) {
      return res.status(500).json({ ok: false, error: 'Falha ao persistir configuração.' });
    }

    return res.status(200).json({
      ok: true,
      data: {
        id: saved.id,
        enabled: !!saved.enabled,
        idle_minutes: Number(saved.idle_minutes),
        warn_seconds: Number(saved.warn_seconds),
        silent: !!saved.silent,
        redirect_url: saved.redirect_url,
        updated_by: saved.updated_by,
        updated_at: saved.updated_at
      }
    });
  } catch (err) {
    console.error('[sessionTimeOutConfigController.update] erro', err);
    return res.status(500).json({ ok: false, error: 'Erro interno ao atualizar configuração.' });
  }
}
