// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsFiscalOriginsSchema.repository.js — DDL                      ║
// ║ ensureProductsFiscalOriginsTable / ensureOnce (flag por processo)    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { DDL, DDL_INDEXES } from './productsFiscalOrigins.catalog.js';

/* ========================================================================== */
/* DDL                                                                        */
/* ========================================================================== */

let ensured = false;

export async function ensureProductsFiscalOriginsTable(client = pool) {
  await client.query(DDL);

  for (const statement of DDL_INDEXES) {
    await client.query(statement);
  }
}

/**
 * Garante a tabela uma única vez por processo.
 * Em caso de falha o flag não é marcado, para que a próxima chamada tente
 * novamente em vez de quebrar silenciosamente.
 */
export async function ensureOnce(client = pool) {
  if (ensured) return;

  await ensureProductsFiscalOriginsTable(client);
  ensured = true;
}
