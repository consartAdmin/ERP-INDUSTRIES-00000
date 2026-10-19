// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmDealsOutcomesOperations.repository.js — resumo por outcome e    ║
// ║ operações concluídas (por code / por id)                           ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE, DEALS_TABLE, STAGES_TABLE } from './crmDealsOutcomes.constants.js';
import { normalizeInteger } from './crmDealsOutcomes.sanitizers.js';
import { normalizeCrmCompany } from '../crmDeals/crmDeals.utils.js';
import {
  getCrmDealsOutcomeById,
  getCrmDealsOutcomeByCode,
} from './crmDealsOutcomesQuery.repository.js';

/* =======================================================================
 * SUMMARY
 * ======================================================================= */

export async function listCrmDealsOutcomesSummary() {
  const sql = `
    SELECT
      o.id,
      o.name,
      o.icon,
      o.color,
      o.sort_order,
      o.is_active,
      o.created_at,
      o.code,
      o.outcome_type,
      COUNT(d.id)::int AS deals_count,
      COALESCE(SUM(COALESCE(d.value, 0)), 0)::numeric AS total_value
    FROM ${TABLE} o
    LEFT JOIN ${DEALS_TABLE} d
      ON d.outcome_id = o.id
     AND COALESCE(d.is_closed, false) = true
    WHERE o.is_active = true
    GROUP BY
      o.id, o.name, o.icon, o.color, o.sort_order,
      o.is_active, o.created_at, o.code, o.outcome_type
    ORDER BY o.sort_order ASC, o.name ASC
  `;

  const { rows } = await pool.query(sql);
  return rows;
}

/* =======================================================================
 * OPERATIONS BY OUTCOME
 * ======================================================================= */

export async function listOperationsByOutcomeCode(code, company) {
  const outcome = await getCrmDealsOutcomeByCode(code);

  if (!outcome) {
    const err = new Error('Conclusão não encontrada.');
    err.statusCode = 404;
    throw err;
  }

  const sql = `
    SELECT
      d.id,

      COALESCE(
        NULLIF(TRIM(d.tag), ''),
        NULLIF(TRIM(d.next_step), ''),
        CONCAT('Negociação #', d.id::text)
      ) AS title,

      d.customer_id,
      d.seller_id,
      d.stage_id,
      d.outcome_id,

      COALESCE(d.estimated_value, 0)::numeric AS value,

      d.outcome_at AS closed_at,
      d.updated_at,
      d.created_at,

      COALESCE(
        NULLIF(TRIM(d.customer_name), ''),
        'Sem cliente'
      ) AS customer_name,

      COALESCE(
        NULLIF(TRIM(d.seller_name), ''),
        'Sem vendedor'
      ) AS seller_name,

      COALESCE(
        NULLIF(TRIM(s.stage_name), ''),
        NULLIF(TRIM(s.code), ''),
        'Sem etapa'
      ) AS stage_name,

      o.name AS outcome_name,
      o.code AS outcome_code,

      d.loss_reason_id,
      d.loss_notes AS note
    FROM ${DEALS_TABLE} d
    INNER JOIN ${TABLE} o
      ON o.id = d.outcome_id
    LEFT JOIN ${STAGES_TABLE} s
      ON s.id = d.stage_id
    WHERE o.code = $1
      AND COALESCE(d.is_closed, false) = true
      AND d.crm_company = $2
    ORDER BY d.outcome_at DESC NULLS LAST, d.id DESC
  `;

  const { rows } = await pool.query(sql, [code, normalizeCrmCompany(company)]);

  const totalValue = rows.reduce((sum, row) => sum + Number(row.value || 0), 0);

  return {
    outcome,
    total: rows.length,
    totalValue,
    rows
  };
}

export async function listOperationsByOutcomeId(outcomeId, company) {
  const outcome = await getCrmDealsOutcomeById(outcomeId);

  if (!outcome) {
    const err = new Error('Conclusão não encontrada.');
    err.statusCode = 404;
    throw err;
  }

  const sql = `
    SELECT
      d.id,

      COALESCE(
        NULLIF(TRIM(d.tag), ''),
        NULLIF(TRIM(d.next_step), ''),
        CONCAT('Negociação #', d.id::text)
      ) AS title,

      d.customer_id,
      d.seller_id,
      d.stage_id,
      d.outcome_id,

      COALESCE(d.estimated_value, 0)::numeric AS value,

      d.outcome_at AS closed_at,
      d.updated_at,
      d.created_at,

      COALESCE(
        NULLIF(TRIM(d.customer_name), ''),
        'Sem cliente'
      ) AS customer_name,

      COALESCE(
        NULLIF(TRIM(d.seller_name), ''),
        'Sem vendedor'
      ) AS seller_name,

      COALESCE(
        NULLIF(TRIM(s.stage_name), ''),
        NULLIF(TRIM(s.code), ''),
        'Sem etapa'
      ) AS stage_name,

      o.name AS outcome_name,
      o.code AS outcome_code,

      d.loss_reason_id,
      d.loss_notes AS note
    FROM ${DEALS_TABLE} d
    INNER JOIN ${TABLE} o
      ON o.id = d.outcome_id
    LEFT JOIN ${STAGES_TABLE} s
      ON s.id = d.stage_id
    WHERE o.id = $1
      AND COALESCE(d.is_closed, false) = true
      AND d.crm_company = $2
    ORDER BY d.outcome_at DESC NULLS LAST, d.id DESC
  `;

  const { rows } = await pool.query(sql, [normalizeInteger(outcomeId, 0), normalizeCrmCompany(company)]);

  const totalValue = rows.reduce((sum, row) => sum + Number(row.value || 0), 0);

  return {
    outcome,
    total: rows.length,
    totalValue,
    rows
  };
}
