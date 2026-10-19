// ╔════════════════════════════════════════════════════════════════════╗
// ║ modulePasswordsController.js — Senhas dos Módulos (ESM)            ║
// ║ CONSART ERP                                                       ║
// ║ 🔐 Rotas exigem login + perfil administrador                       ║
// ╚════════════════════════════════════════════════════════════════════╝

import modulePasswordsApi from '../repositories/modulePasswords/modulePasswords.index.js';

function sendError(res, err, scope) {
  const status = err.status || 500;
  if (status >= 500) console.error(`❌ modulePasswords.${scope} error:`, err);
  return res.status(status).json({ ok: false, message: err.message });
}

// Fallback do .env por módulo/ação (usado só quando não há linha na tabela)
const ENV_FALLBACKS = {
  'CUSTOMERS:EXPORT': 'EXPORT_DOWNLOAD_KEY',
};

/** GET /status?module=X&action=Y → { required } (qualquer usuário logado) */
export async function status(req, res) {
  try {
    const moduleCode = String(req.query?.module ?? '').trim().toUpperCase();
    const actionCode = String(req.query?.action ?? '').trim().toUpperCase();
    if (!moduleCode || !actionCode) {
      return res.status(400).json({ ok: false, message: 'Informe module e action.' });
    }

    const envName = ENV_FALLBACKS[`${moduleCode}:${actionCode}`];
    const required = await modulePasswordsApi.isModulePasswordRequired(moduleCode, actionCode, {
      fallback: envName ? process.env[envName] : '',
    });
    return res.json({ ok: true, data: { required } });
  } catch (err) {
    return sendError(res, err, 'status');
  }
}

export async function list(req, res) {
  try {
    const data = await modulePasswordsApi.list();
    return res.json({ ok: true, data });
  } catch (err) {
    return sendError(res, err, 'list');
  }
}

export async function create(req, res) {
  try {
    const data = await modulePasswordsApi.create(req.body || {}, req.user?.user_id ?? null);
    return res.status(201).json({ ok: true, data });
  } catch (err) {
    return sendError(res, err, 'create');
  }
}

export async function updateById(req, res) {
  try {
    const data = await modulePasswordsApi.updateById(
      req.params.id,
      req.body || {},
      req.user?.user_id ?? null
    );
    if (!data) return res.status(404).json({ ok: false, message: 'Registro não encontrado.' });
    return res.json({ ok: true, data });
  } catch (err) {
    return sendError(res, err, 'updateById');
  }
}

export async function clearPassword(req, res) {
  try {
    const data = await modulePasswordsApi.clearPassword(req.params.id, req.user?.user_id ?? null);
    if (!data) return res.status(404).json({ ok: false, message: 'Registro não encontrado.' });
    return res.json({ ok: true, data });
  } catch (err) {
    return sendError(res, err, 'clearPassword');
  }
}

export async function removeById(req, res) {
  try {
    const result = await modulePasswordsApi.removeById(req.params.id);
    if (!result.ok) return res.status(404).json({ ok: false, message: 'Registro não encontrado.' });
    return res.json({ ok: true });
  } catch (err) {
    return sendError(res, err, 'removeById');
  }
}

export default {
  status,
  list,
  create,
  updateById,
  clearPassword,
  removeById,
};
