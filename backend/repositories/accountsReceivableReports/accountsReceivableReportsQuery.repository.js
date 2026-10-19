// ╔════════════════════════════════════════════════════════════════════╗
// ║ accountsReceivableReportsQuery.repository.js — getSummary /        ║
// ║ listSales / listAllSales (conciliação vendas x receber)            ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { ORDER_COLUMNS } from './accountsReceivableReports.constants.js';
import { positiveInt } from './accountsReceivableReports.sanitizers.js';
import { filtersSql, baseCte } from './accountsReceivableReports.sql.js';

export async function getSummary(filters = {}) {
  const filter = filtersSql(filters);
  const { rows } = await pool.query(`
    ${baseCte(filter.sql, filters.onlyDivergences)}
    SELECT
      COUNT(*)::integer AS sales_count,
      COUNT(*) FILTER (WHERE reconciliation_status = 'SEM_CONTA')::integer AS without_receivable_count,
      COUNT(*) FILTER (WHERE reconciliation_status = 'DIVERGENTE')::integer AS divergent_count,
      COALESCE(SUM(sale_total), 0)::numeric AS sales_total,
      COALESCE(SUM(receivable_value), 0)::numeric AS receivable_total,
      COALESCE(SUM(received_value), 0)::numeric AS received_total,
      COALESCE(SUM(balance), 0)::numeric AS outstanding_total,
      COALESCE(SUM(balance) FILTER (WHERE reconciliation_status = 'VENCIDA'), 0)::numeric AS overdue_total,
      COALESCE(SUM(difference), 0)::numeric AS difference_total
    FROM filtered;
  `, filter.params);
  return rows[0];
}

export async function listSales(filters = {}) {
  const page = positiveInt(filters.page, 1);
  const pageSize = positiveInt(filters.pageSize, 20, 200);
  const direction = String(filters.orderDirection).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const orderColumn = ORDER_COLUMNS[filters.orderBy] || ORDER_COLUMNS.issue_date;
  const filter = filtersSql(filters);
  const cte = baseCte(filter.sql, filters.onlyDivergences);
  const offset = (page - 1) * pageSize;

  const [dataResult, countResult] = await Promise.all([
    pool.query(`
      ${cte}
      SELECT * FROM filtered s
      ORDER BY ${orderColumn} ${direction}, s.order_id DESC
      LIMIT $${filter.nextIndex} OFFSET $${filter.nextIndex + 1};
    `, [...filter.params, pageSize, offset]),
    pool.query(`${cte} SELECT COUNT(*)::integer AS total FROM filtered;`, filter.params),
  ]);

  const total = Number(countResult.rows[0]?.total || 0);
  return { data: dataResult.rows, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function listAllSales(filters = {}) {
  const filter = filtersSql(filters);
  const { rows } = await pool.query(`
    ${baseCte(filter.sql, filters.onlyDivergences)}
    SELECT * FROM filtered s ORDER BY s.issue_date DESC, s.order_id DESC;
  `, filter.params);
  return rows;
}
