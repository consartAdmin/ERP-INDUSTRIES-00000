// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeWebhookEventsRemove.repository.js — deleteOldWebhookEvents        ║
// ║ NÃO cria pool: sempre receber pgPool como argumento                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { TB } from './nfeWebhookEvents.constants.js';

/**
 * Apaga eventos antigos (ex.: limpeza de log).
 * @param {import('pg').Pool} pgPool
 * @param {string} olderThanInterval exemplo: '90 days'
 */
export async function deleteOldWebhookEvents(pgPool, olderThanInterval = '180 days') {
  const result = await pgPool.query(
    `
    DELETE FROM ${TB}
    WHERE created_at < (CURRENT_TIMESTAMP - $1::interval)
    `,
    [olderThanInterval]
  );
  return result.rowCount || 0;
}
