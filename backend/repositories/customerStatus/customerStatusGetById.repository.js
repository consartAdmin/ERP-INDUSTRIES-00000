// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerStatusGetById.repository.js — getById / getByCustomerId    ║
// ║ Tabela: public."customerStatus" (+ JOIN customerStatusTypes)       ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { erpTable } from '../../utils/erpCompanyContext.js';
import { tbl, ALIAS } from './customerStatus.constants.js';
import { toNumOrNull } from './customerStatus.sanitizers.js';
import { mapRow, mapRowWithStatus } from './customerStatus.mappers.js';

/** GET BY ID */
export async function getById(id) {
  const sid = toNumOrNull(id);
  if (!sid) throw new Error('invalid customerStatus id');

  const { rows } = await pool.query(`SELECT * FROM ${tbl()} WHERE id = $1`, [sid]);
  return rows[0] ? mapRow(rows[0]) : null;
}

/** GET BY customer_id — com JOIN em customerStatusTypes */
export async function getByCustomerId(customerId) {
  const cid = toNumOrNull(customerId);
  if (!cid) throw new Error('invalid customer_id');

  const sql = `
    SELECT
      ${ALIAS}.id,
      ${ALIAS}.customer_id,
      ${ALIAS}.status_type_id,
      ${ALIAS}.note,
      ${ALIAS}.updated_at,
      ${ALIAS}.updated_by,
      cst.name_pt       AS status_name_pt,
      cst.internal_code AS status_code,
      cst.color_hex     AS status_color_hex
    FROM ${tbl()} ${ALIAS}
    JOIN ${erpTable('public."customerStatusTypes"')} cst
      ON cst.id = ${ALIAS}.status_type_id
    WHERE ${ALIAS}.customer_id = $1
    LIMIT 1;
  `;

  const { rows } = await pool.query(sql, [cid]);
  return rows[0] ? mapRowWithStatus(rows[0]) : null;
}
