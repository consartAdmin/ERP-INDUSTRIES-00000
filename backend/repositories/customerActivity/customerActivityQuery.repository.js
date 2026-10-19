// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerActivityQuery.repository.js — list / summary               ║
// ║ Tabela: "customerActivity"                                         ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE } from './customerActivity.constants.js';
import { normalizePaging, normalizeStatus } from './customerActivity.sanitizers.js';

export async function listCustomerActivities({
  page = 1,
  limit = 20,
  status = '',
  search = '',
  onlyNeedsFollowup = false,
} = {}) {
  const { safePage, safeLimit, offset } = normalizePaging(page, limit);

  const where = [];
  const params = [];
  let idx = 1;

  const normalizedStatus = normalizeStatus(status);
  if (normalizedStatus) {
    where.push(`ca.status = $${idx++}`);
    params.push(normalizedStatus);
  }

  if (search?.trim()) {
    where.push(`
      (
        CAST(c.customer_id AS TEXT) ILIKE $${idx}
        OR COALESCE(c.trade_name, '') ILIKE $${idx}
        OR COALESCE(c.legal_name, '') ILIKE $${idx}
        OR COALESCE(c.tax_id, '') ILIKE $${idx}
        OR COALESCE(c.email, '') ILIKE $${idx}
        OR COALESCE(c.phone_number, '') ILIKE $${idx}
        OR COALESCE(c.mobile_number, '') ILIKE $${idx}
      )
    `);
    params.push(`%${search.trim()}%`);
    idx++;
  }

  if (String(onlyNeedsFollowup) === 'true' || onlyNeedsFollowup === true) {
    where.push(`
      ca.status IN ('at_risk', 'inactive')
      AND (
        ca.last_followup_at IS NULL
        OR ca.last_followup_at < NOW() - INTERVAL '3 days'
      )
    `);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const countSql = `
    SELECT COUNT(*)::INT AS total
    FROM ${TABLE} ca
    LEFT JOIN "customers" c ON c.customer_id = ca.customer_id
    ${whereSql};
  `;

  const dataSql = `
    SELECT
      ca.id,
      ca.customer_id,
      ca.last_purchase_date,
      ca.last_contact_date,
      ca.days_without_purchase,
      ca.status,
      ca.last_followup_type,
      ca.last_followup_at,
      ca.followup_count,
      ca.inactivity_reason,
      ca.crm_deals_outcome_id,
      ca.source_module,
      ca.source_reference_id,
      ca.created_at,
      ca.updated_at,

      c.trade_name,
      c.legal_name,
      c.tax_id,
      c.email,
      c.phone_number,
      c.mobile_number,
      c.city,
      c.state,
      c.salesperson,
      c.is_active,

      o.name AS outcome_name,
      o.code AS outcome_code,
      o.outcome_type,
      o.icon AS outcome_icon,
      o.color AS outcome_color

    FROM ${TABLE} ca
    LEFT JOIN "customers" c
      ON c.customer_id = ca.customer_id
    LEFT JOIN "crmDealsOutcomes" o
      ON o.id = ca.crm_deals_outcome_id
    ${whereSql}
    ORDER BY
      ca.days_without_purchase DESC NULLS LAST,
      ca.customer_id ASC
    LIMIT $${idx++}
    OFFSET $${idx++};
  `;

  const countRes = await pool.query(countSql, params);
  const total = countRes.rows[0]?.total || 0;

  const dataParams = [...params, safeLimit, offset];
  const dataRes = await pool.query(dataSql, dataParams);

  return {
    total,
    page: safePage,
    limit: safeLimit,
    rows: dataRes.rows,
  };
}

export async function getCustomerActivitySummary() {
  const sql = `
    SELECT
      status,
      COUNT(*)::INT AS total
    FROM ${TABLE}
    GROUP BY status
    ORDER BY status;
  `;
  const res = await pool.query(sql);
  return res.rows;
}
