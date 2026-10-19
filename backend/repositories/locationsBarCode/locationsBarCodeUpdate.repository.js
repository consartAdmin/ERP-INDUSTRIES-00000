// ╔══════════════════════════════════════════════════════════════════════╗
// ║ locationsBarCodeUpdate.repository.js — update / deactivate / remove║
// ║ Table: public."locationsBarCode"                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { TABLES } from './locationsBarCode.constants.js';
import { buildUpdateSet } from './locationsBarCode.utils.js';

export async function update(pgPool, id, payload) {
  const { setClause, values } = buildUpdateSet(payload, 1);

  const sql = `
    UPDATE ${TABLES.BARCODES}
    ${setClause}
    WHERE id = $${values.length + 1}
    RETURNING *;
  `;

  const { rows } = await pgPool.query(sql, [...values, id]);
  return rows[0] || null;
}

export async function deactivate(pgPool, id) {
  const sql = `
    UPDATE ${TABLES.BARCODES}
    SET active = FALSE,
        updated_at = NOW()
    WHERE id = $1
    RETURNING *;
  `;

  const { rows } = await pgPool.query(sql, [id]);
  return rows[0] || null;
}

export async function remove(pgPool, id) {
  await pgPool.query(`DELETE FROM ${TABLES.BARCODES} WHERE id = $1;`, [id]);
  return { success: true };
}
