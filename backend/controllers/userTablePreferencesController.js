// ╔══════════════════════════════════════════════════════════════════════╗
// ║ userTablePreferencesController.js — Layout de tabelas por usuário    ║
// ║ GET    /api/user-table-preferences/:tableKey                         ║
// ║ PUT    /api/user-table-preferences/:tableKey   { prefs: {...} }      ║
// ║ DELETE /api/user-table-preferences/:tableKey   (restaurar padrão)    ║
// ║ O usuário vem sempre do token (requireAuth), nunca do body.          ║
// ╚══════════════════════════════════════════════════════════════════════╝

import userTablePreferencesApi from '../repositories/userTablePreferences/userTablePreferences.index.js';
import { TABLE_KEY_PATTERN, MAX_PREFS_BYTES } from '../repositories/userTablePreferences/userTablePreferences.constants.js';

function resolveContext(req, res) {
  const userId = Number(req.user?.id ?? req.user?.user_id);
  if (!Number.isInteger(userId) || userId <= 0) {
    res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
    return null;
  }

  const tableKey = String(req.params.tableKey || '').trim();
  if (!TABLE_KEY_PATTERN.test(tableKey)) {
    res.status(400).json({ ok: false, error: 'tableKey inválido' });
    return null;
  }

  return { userId, tableKey };
}

export async function getPreferences(req, res) {
  const ctx = resolveContext(req, res);
  if (!ctx) return;
  try {
    const row = await userTablePreferencesApi.get(ctx.userId, ctx.tableKey);
    return res.json({ ok: true, prefs: row?.prefs ?? null, updated_at: row?.updated_at ?? null });
  } catch (err) {
    console.error('[userTablePreferences][get]', err);
    return res.status(500).json({ ok: false, error: 'Erro ao carregar preferências.' });
  }
}

export async function savePreferences(req, res) {
  const ctx = resolveContext(req, res);
  if (!ctx) return;

  const prefs = req.body?.prefs;
  if (!prefs || typeof prefs !== 'object' || Array.isArray(prefs)) {
    return res.status(400).json({ ok: false, error: 'prefs deve ser um objeto.' });
  }
  if (Buffer.byteLength(JSON.stringify(prefs)) > MAX_PREFS_BYTES) {
    return res.status(413).json({ ok: false, error: 'Preferências muito grandes.' });
  }

  try {
    const row = await userTablePreferencesApi.save(ctx.userId, ctx.tableKey, prefs);
    return res.json({ ok: true, prefs: row.prefs, updated_at: row.updated_at });
  } catch (err) {
    console.error('[userTablePreferences][save]', err);
    return res.status(500).json({ ok: false, error: 'Erro ao salvar preferências.' });
  }
}

export async function resetPreferences(req, res) {
  const ctx = resolveContext(req, res);
  if (!ctx) return;
  try {
    await userTablePreferencesApi.reset(ctx.userId, ctx.tableKey);
    return res.json({ ok: true, prefs: null });
  } catch (err) {
    console.error('[userTablePreferences][reset]', err);
    return res.status(500).json({ ok: false, error: 'Erro ao restaurar preferências.' });
  }
}
