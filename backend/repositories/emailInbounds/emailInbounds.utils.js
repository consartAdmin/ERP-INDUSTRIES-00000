// ╔════════════════════════════════════════════════════════════════════╗
// ║ emailInbounds.utils.js — Logs, conexão e parse JSON                ║
// ╚════════════════════════════════════════════════════════════════════╝

import { DEBUG_EMAIL_INBOUNDS } from './emailInbounds.constants.js';

export function log(step, payload = {}) {
  if (!DEBUG_EMAIL_INBOUNDS) return;
  console.log(`[emailInboundsApi][${step}]`, {
    ts: new Date().toISOString(),
    ...payload,
  });
}

export function warn(step, payload = {}) {
  console.warn(`[emailInboundsApi][${step}]`, {
    ts: new Date().toISOString(),
    ...payload,
  });
}

export function errorLog(step, err, payload = {}) {
  console.error(`[emailInboundsApi][${step}]`, {
    ts: new Date().toISOString(),
    message: err?.message,
    code: err?.code,
    detail: err?.detail,
    table: err?.table,
    column: err?.column,
    stack: err?.stack,
    ...payload,
  });
}

export async function withClient(pgPool, fn, label = 'query') {
  const startedAt = Date.now();
  const client = await pgPool.connect();

  log('DB_CLIENT_ACQUIRED', { label });

  try {
    const result = await fn(client);

    log('DB_CLIENT_SUCCESS', {
      label,
      ms: Date.now() - startedAt,
    });

    return result;
  } catch (err) {
    errorLog('DB_CLIENT_ERROR', err, {
      label,
      ms: Date.now() - startedAt,
    });

    throw err;
  } finally {
    client.release();

    log('DB_CLIENT_RELEASED', {
      label,
      ms: Date.now() - startedAt,
    });
  }
}

export function safeJsonArrayParse(str) {
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
