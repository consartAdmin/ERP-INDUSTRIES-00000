// ╔════════════════════════════════════════════════════════════════════╗
// ║ chartOfAccountsGetById.repository.js — getById / getByCode /       ║
// ║ existsByCode                                                       ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TABLE, PK } from './chartOfAccounts.constants.js';
import { FULL_SELECT } from './chartOfAccounts.sql.js';
import { normalizeId, normalizeRequiredText } from './chartOfAccounts.sanitizers.js';
import { query } from './chartOfAccounts.utils.js';
import { ensureTable } from './chartOfAccountsSchema.repository.js';

/* ───────────────────────────── API ───────────────────────────── */

export async function getById(id) {
  await ensureTable();

  const safeId = normalizeId(id, 'id');

  const { rows } = await query(
    `
      SELECT
        ${FULL_SELECT}
      FROM ${TABLE} coa
      LEFT JOIN ${TABLE} parent
        ON parent.${PK} = coa.parent_account_id
      WHERE coa.${PK} = $1
      LIMIT 1
    `,
    [safeId]
  );

  return rows[0] || null;
}

export async function getByCode(code) {
  await ensureTable();

  const safeCode = normalizeRequiredText(code, 'code');

  const { rows } = await query(
    `
      SELECT
        ${FULL_SELECT}
      FROM ${TABLE} coa
      LEFT JOIN ${TABLE} parent
        ON parent.${PK} = coa.parent_account_id
      WHERE coa.code = $1
      LIMIT 1
    `,
    [safeCode]
  );

  return rows[0] || null;
}

export async function existsByCode(code, excludeId = null) {
  const params = [code];
  let sql = `SELECT 1 FROM ${TABLE} WHERE code = $1`;

  if (excludeId) {
    params.push(excludeId);
    sql += ` AND ${PK} <> $2`;
  }

  sql += ` LIMIT 1`;

  const { rowCount } = await query(sql, params);
  return rowCount > 0;
}
