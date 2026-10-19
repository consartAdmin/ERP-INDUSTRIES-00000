// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerStatusQuery.repository.js — list (com total, para grids)   ║
// ║ Tabela: public."customerStatus" (+ JOIN customerStatusTypes)       ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { erpTable } from '../../utils/erpCompanyContext.js';
import { tbl, ALIAS } from './customerStatus.constants.js';
import { toNumOrNull } from './customerStatus.sanitizers.js';
import { mapRowWithStatus } from './customerStatus.mappers.js';

/** LIST — com total, para grids */
export async function list({
  status_type_id,
  limit = 50,
  offset = 0,
  orderBy = 'updated_at',
  order = 'desc',
} = {}) {
  const params = [];
  const where = [];

  const orderSafe = ['updated_at', 'customer_id', 'status_type_id'].includes(orderBy)
    ? orderBy
    : 'updated_at';
  const dir = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  if (status_type_id != null && Number.isFinite(Number(status_type_id))) {
    params.push(toNumOrNull(status_type_id));
    where.push(`${ALIAS}.status_type_id = $${params.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const lim = toNumOrNull(limit) ?? 50;
  const off = toNumOrNull(offset) ?? 0;

  params.push(lim);
  const limIdx = params.length;
  params.push(off);
  const offIdx = params.length;

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
    ${whereSql}
    ORDER BY ${ALIAS}."${orderSafe}" ${dir}
    LIMIT $${limIdx}
    OFFSET $${offIdx};
  `;

  const countSql = `
    SELECT COUNT(*)::INT AS total
    FROM ${tbl()} ${ALIAS}
    ${whereSql};
  `;

  const countParams = params.slice(0, params.length - 2);

  const [rowsRes, totalRes] = await Promise.all([
    pool.query(sql, params),
    pool.query(countSql, countParams),
  ]);

  return {
    rows: rowsRes.rows.map(mapRowWithStatus),
    total: totalRes.rows[0]?.total ?? 0,
    limit: lim,
    offset: off,
  };
}

export default list;
