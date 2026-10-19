// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmDealsPerformanceQuery.repository.js — listActions /             ║
// ║ getSellerPerformance (indicadores por vendedor/período)            ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE } from './crmDealsPerformance.constants.js';
import { buildError } from './crmDealsPerformance.utils.js';

/** Lista ações com filtros */
export async function listActions({
  sellerId,
  dealId,
  actionType,
  startDate,
  endDate,
  limit = 200,
  offset = 0,
} = {}) {
  try {
    const params = [];
    let where = 'WHERE 1=1';

    if (sellerId) {
      params.push(sellerId);
      where += ` AND seller_id = $${params.length}`;
    }
    if (dealId) {
      params.push(dealId);
      where += ` AND deal_id = $${params.length}`;
    }
    if (actionType) {
      params.push(String(actionType).toUpperCase());
      where += ` AND action_type = $${params.length}`;
    }
    if (startDate) {
      params.push(startDate);
      where += ` AND created_at::date >= $${params.length}::date`;
    }
    if (endDate) {
      params.push(endDate);
      where += ` AND created_at::date <= $${params.length}::date`;
    }

    params.push(limit);
    params.push(offset);

    const sql = `
      SELECT
        id, deal_id, stage_id, stage_code,
        seller_id, seller_name, user_id,
        customer_id, customer_name,
        action_type, from_stage_id, to_stage_id,
        estimated_value, value_at_moment,
        details, ip, user_agent,
        created_at
      FROM ${TABLE}
      ${where}
      ORDER BY created_at DESC, id DESC
      LIMIT $${params.length - 1}
      OFFSET $${params.length}
    `;

    const { rows } = await pool.query(sql, params);
    return { ok: true, data: rows };
  } catch (err) {
    return buildError(err, 'crmDealsReativationPerformanceApi.listActions');
  }
}

/**
 * Resumo estilo "salesPerformance" por vendedor
 * - quantidade de ações
 * - quantos moves
 * - conversões e perdas
 * - soma de valores convertidos/perdidos
 */
export async function getSellerPerformance({
  sellerId,
  startDate,
  endDate,
} = {}) {
  try {
    const params = [];
    let where = 'WHERE 1=1';

    if (sellerId) {
      params.push(sellerId);
      where += ` AND seller_id = $${params.length}`;
    }
    if (startDate) {
      params.push(startDate);
      where += ` AND created_at::date >= $${params.length}::date`;
    }
    if (endDate) {
      params.push(endDate);
      where += ` AND created_at::date <= $${params.length}::date`;
    }

    const sql = `
      SELECT
        seller_id,
        COALESCE(MAX(seller_name), '—') AS seller_name,

        COUNT(*) AS actions_total,

        COALESCE(SUM(CASE WHEN action_type='CREATE_DEAL' THEN 1 ELSE 0 END),0) AS created_cards,
        COALESCE(SUM(CASE WHEN action_type='UPDATE_DEAL' THEN 1 ELSE 0 END),0) AS updates,
        COALESCE(SUM(CASE WHEN action_type='MOVE_STAGE' THEN 1 ELSE 0 END),0) AS moves,

        COALESCE(SUM(CASE WHEN action_type='OUTCOME_CONVERSION' THEN 1 ELSE 0 END),0) AS conversions_count,
        COALESCE(SUM(CASE WHEN action_type='OUTCOME_LOSS' THEN 1 ELSE 0 END),0) AS losses_count,

        COALESCE(SUM(CASE WHEN action_type='OUTCOME_CONVERSION'
          THEN COALESCE(value_at_moment, estimated_value, 0) ELSE 0 END),0) AS conversions_value,

        COALESCE(SUM(CASE WHEN action_type='OUTCOME_LOSS'
          THEN COALESCE(value_at_moment, estimated_value, 0) ELSE 0 END),0) AS losses_value

      FROM ${TABLE}
      ${where}
      GROUP BY seller_id
      ORDER BY conversions_value DESC, conversions_count DESC, actions_total DESC
    `;

    const { rows } = await pool.query(sql, params);
    return { ok: true, data: rows };
  } catch (err) {
    return buildError(err, 'crmDealsReativationPerformanceApi.getSellerPerformance');
  }
}
