// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ emailInboundsBootstrap.js — Bootstrap IMAP Inbounds (Multi-account)     ║
// ║ CONSART ERP — Start listeners for ALL active accounts                    ║
// ║ Path: backend/services/email/emailInboundsBootstrap.js                   ║
// ║                                                                          ║
// ║ ✅ Inicia TODAS as contas ativas automaticamente                          ║
// ║ ✅ Não derruba o backend se 1 conta falhar (non-blocking)                ║
// ║ ✅ Respeita lock por account_id (evita 2 listeners por conta)            ║
// ║ ✅ Carrega secrets corretamente (getAccountById includeSecrets:true)     ║
// ║ ✅ Retorna resumo (ok/fail) para logs e health                           ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import emailAccountsApi from '../../repositories/emailAccounts/emailAccounts.index.js';
import { startEmailInboundsListener } from '../../controllers/emailInboundsController.js';
import { listActiveListeners } from './emailListenerRegistry.js';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function asInt(v, d = 0) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : d;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/* -------------------------------------------------------------------------- */
/* Bootstrap (multi-account)                                                  */
/* -------------------------------------------------------------------------- */
/**
 * Inicia listeners IMAP para TODAS as contas ativas.
 *
 * @param {object} opts
 * @param {number} [opts.limit=50]      - máximo de contas ativas a carregar
 * @param {number} [opts.offset=0]      - offset (debug)
 * @param {number} [opts.staggerMs=350] - atraso entre startups (evita spike)
 * @param {boolean} [opts.includeInactive=false] - incluir inativas (debug)
 * @returns {Promise<{ok:boolean, started:number, failed:number, results:Array}>}
 */
export async function emailInboundsBootstrap(opts = {}) {
  const limit = asInt(opts.limit, 50);
  const offset = asInt(opts.offset, 0);
  const staggerMs = asInt(opts.staggerMs, 350);
  const includeInactive = Boolean(opts.includeInactive);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[Bootstrap] Email Inbounds — Multi-account');
  console.log(
    `[Bootstrap] loading accounts | onlyActive=${!includeInactive} limit=${limit} offset=${offset}`
  );

  // 1) Lista contas (SEM secrets)
  const list = await emailAccountsApi.listAccounts(pool, {
    onlyActive: !includeInactive,
    limit,
    offset,
  });

  const accounts = Array.isArray(list) ? list : [];
  if (!accounts.length) {
    console.warn('[Bootstrap] Nenhuma conta encontrada para iniciar listener.');
    return {
      ok: true,
      started: 0,
      failed: 0,
      results: [],
    };
  }

  let started = 0;
  let failed = 0;
  const results = [];

  // 2) Sobe listeners (1 por conta)
  for (const item of accounts) {
    const id = item?.id;

    if (!id) {
      failed += 1;
      results.push({
        account_id: null,
        ok: false,
        error: 'Conta sem id (registro inválido)',
      });
      continue;
    }

    // stagger para evitar pico de conexão IMAP / DNS / TLS
    if (staggerMs > 0) {
      await sleep(staggerMs);
    }

    try {
      // IMPORTANT: startEmailInboundsListener já faz:
      // - getAccountById(includeSecrets:true)
      // - lock por account_id
      // - validateImapConfig
      await startEmailInboundsListener({ account_id: id });

      started += 1;
      results.push({
        account_id: String(id),
        ok: true,
      });

      console.log(`[Bootstrap] Listener OK — account_id=${id}`);
    } catch (err) {
      failed += 1;
      results.push({
        account_id: String(id),
        ok: false,
        error: err?.message || String(err),
      });

      console.error(`[Bootstrap] Listener FAIL — account_id=${id}`, err?.message || err);
      // continua para as próximas contas
    }
  }

  console.log(
    `[Bootstrap] Email Inbounds завершено | ok=${started} fail=${failed} activeLocks=${listActiveListeners().length}`
  );
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  return {
    ok: failed === 0,
    started,
    failed,
    results,
  };
}

/* -------------------------------------------------------------------------- */
/* Default export (optional)                                                  */
/* -------------------------------------------------------------------------- */

export default emailInboundsBootstrap;
