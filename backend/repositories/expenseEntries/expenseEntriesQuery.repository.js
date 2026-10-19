// ╔════════════════════════════════════════════════════════════════════╗
// ║ expenseEntriesQuery.repository.js — list / getById                 ║
// ║ Tabela: public."expenseEntries"                                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import { q, parseOrder, buildWhere, SELECT_ALIASED } from './expenseEntries.sql.js';
import { parsePaging } from './expenseEntries.utils.js';

export async function list({ page, pageSize, orderBy, status, supplierDocument, q: qt, dateFrom, dateTo }) {
  const { limit, offset, ...pg } = parsePaging({ page, pageSize });
  const { whereSql, params } = buildWhere({ status, supplierDocument, q: qt, dateFrom, dateTo });
  const orderSql = parseOrder(orderBy);

  const countSql = `
      SELECT COUNT(*)::bigint AS total
      FROM public."expenseEntries"
      ${whereSql}
    `;

  const dataSql = `
      ${SELECT_ALIASED}
      ${whereSql}
      ${orderSql}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

  const countRes = await q(countSql, params);
  const total = Number(countRes.rows?.[0]?.total || 0);

  const dataRes = await q(dataSql, [...params, limit, offset]);
  return {
    paging: { ...pg, total, pageSize: limit },
    rows: dataRes.rows || [],
  };
}

export async function getById({ expenseEntryId }) {
  const id = Number(expenseEntryId);
  if (!id) throw new Error('expenseEntryId is required');

  const sql = `
      ${SELECT_ALIASED}
      WHERE expenseentryid = $1
      LIMIT 1
    `;
  const res = await q(sql, [id]);
  return res.rows?.[0] || null;
}
