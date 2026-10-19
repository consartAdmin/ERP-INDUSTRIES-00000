// ╔════════════════════════════════════════════════════════════════════╗
// ║ salesPerformanceDashboard.repository.js — leads atendidos / KPIs   ║
// ║ Fonte: public."crmDealsReativationActions"                         ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_ACTIONS } from './salesPerformance.constants.js';
import { pushDateFilters, pushSellerFilters, buildWhere } from './salesPerformance.sql.js';
import { toInt } from './salesPerformance.utils.js';

/* ======================================================================
   DASHBOARD - LEADS ATTENDED
   ====================================================================== */

export async function getLeadsAttendedDashboard({ inicio, fim, responsaveis = [] }) {
  const params = [];
  const whereParts = [];

  pushDateFilters(whereParts, params, inicio, fim, 'a.created_at');
  pushSellerFilters(whereParts, params, responsaveis, 'a');

  const whereSql = buildWhere(whereParts);

  const sql = `
    SELECT
      a.seller_id AS "vendedorId",
      COALESCE(NULLIF(TRIM(a.seller_name), ''), 'Sem Vendedor') AS vendedor,
      COUNT(DISTINCT a.deal_id)::int AS qtd
    FROM ${TB_ACTIONS} a
    ${whereSql}
    GROUP BY
      a.seller_id,
      COALESCE(NULLIF(TRIM(a.seller_name), ''), 'Sem Vendedor')
    ORDER BY qtd DESC, vendedor ASC
  `;

  const { rows } = await pool.query(sql, params);

  const porVendedor = rows.map((row) => ({
    vendedorId: row.vendedorId != null ? Number(row.vendedorId) : null,
    vendedor: row.vendedor,
    qtd: toInt(row.qtd, 0)
  }));

  const total = porVendedor.reduce((acc, row) => acc + row.qtd, 0);

  return {
    total,
    porVendedor
  };
}

/* ======================================================================
   OPTIONAL KPI - TOTAL ACTIONS
   ====================================================================== */

export async function getSalesPerformanceTotalActions({ inicio, fim, responsaveis = [] }) {
  const params = [];
  const whereParts = [];

  pushDateFilters(whereParts, params, inicio, fim, 'a.created_at');
  pushSellerFilters(whereParts, params, responsaveis, 'a');

  const whereSql = buildWhere(whereParts);

  const sql = `
    SELECT COUNT(*)::int AS total
    FROM ${TB_ACTIONS} a
    ${whereSql}
  `;

  const { rows } = await pool.query(sql, params);

  return {
    total: toInt(rows?.[0]?.total, 0)
  };
}
