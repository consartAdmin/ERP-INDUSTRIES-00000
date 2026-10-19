// ╔════════════════════════════════════════════════════════════════════╗
// ║ salesPerformanceQuery.repository.js — movimentações / por status   ║
// ║ Fonte: crmDealsReativationActions + crmDeals + crmDealsOutcomes    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_ACTIONS, TB_DEALS, TB_OUTCOMES, TB_STATUS_TYPES } from './salesPerformance.constants.js';
import { pushDateFilters, pushSellerFilters, buildWhere, buildActionJoinFilters } from './salesPerformance.sql.js';
import { toInt } from './salesPerformance.utils.js';

/* ======================================================================
   MOVEMENTS
   ====================================================================== */

export async function listSalesPerformanceMovements({ inicio, fim, responsaveis = [] }) {
  const params = [];
  const whereParts = [];

  pushDateFilters(whereParts, params, inicio, fim, 'a.created_at');
  pushSellerFilters(whereParts, params, responsaveis, 'a');

  const whereSql = buildWhere(whereParts);

  const sql = `
    SELECT
      a.created_at AS datahora,
      COALESCE(NULLIF(TRIM(a.seller_name), ''), '—') AS vendedor,
      COALESCE(NULLIF(TRIM(a.customer_name), ''), '—') AS cliente,
      COALESCE(NULLIF(TRIM(a.action_type), ''), 'Movimentação') AS tipo,

      a.deal_id,
      a.stage_id,
      a.stage_code,
      a.from_stage_id,
      a.to_stage_id,

      COALESCE(a.value_at_moment, a.estimated_value, 0)::numeric(18,2) AS valor,
      a.estimated_value,
      a.value_at_moment,

      COALESCE(
        NULLIF(TRIM(d.loss_notes), ''),
        NULLIF(TRIM(o.name), ''),
        NULLIF(TRIM(d.outcome), '')
      ) AS motivo_perda,

      d.loss_reason_id,
      d.outcome_id,
      o.name AS outcome_name,
      o.code AS outcome_code,
      o.outcome_type

    FROM ${TB_ACTIONS} a

    LEFT JOIN ${TB_DEALS} d
      ON d.id = a.deal_id

    LEFT JOIN ${TB_OUTCOMES} o
      ON o.id = d.outcome_id

    ${whereSql}
    ORDER BY a.created_at DESC, a.id DESC
  `;

  const { rows } = await pool.query(sql, params);
  return rows;
}

/* ======================================================================
   STATUS SUMMARY (CARDS)
   ====================================================================== */

export async function listSalesPerformanceByStatus({ inicio, fim, responsaveis = [] }) {
  const params = [];
  const actionJoinFilters = buildActionJoinFilters({
    params,
    inicio,
    fim,
    responsaveis,
    alias: 'a'
  });

  const sql = `
    SELECT
      st.id,
      st.name_pt,
      st.internal_code,
      st.description_en,
      st.color_hex,
      st.sort_order,
      COUNT(DISTINCT a.deal_id)::int AS total
    FROM ${TB_STATUS_TYPES} st
    LEFT JOIN ${TB_DEALS} d
      ON d.status_type_id = st.id
    LEFT JOIN ${TB_ACTIONS} a
      ON a.deal_id = d.id
      ${actionJoinFilters}
    WHERE st.is_active = true
    GROUP BY
      st.id,
      st.name_pt,
      st.internal_code,
      st.description_en,
      st.color_hex,
      st.sort_order
    ORDER BY st.sort_order ASC, st.name_pt ASC
  `;

  const { rows } = await pool.query(sql, params);

  return rows.map((row) => ({
    ...row,
    total: toInt(row.total, 0)
  }));
}
