// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerActivityUpdate.repository.js — update / followup / recalc  ║
// ║ Tabela: "customerActivity"                                         ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE } from './customerActivity.constants.js';
import {
  normalizeStatus,
  normalizeFollowupType,
  normalizeSourceModule,
  toNullableInt,
} from './customerActivity.sanitizers.js';

export async function updateCustomerActivity(customerId, payload = {}) {
  const fields = [];
  const values = [];
  let idx = 1;

  const allowed = {
    last_purchase_date: payload.last_purchase_date ?? undefined,
    last_contact_date: payload.last_contact_date ?? undefined,
    days_without_purchase: payload.days_without_purchase ?? undefined,
    status: payload.status !== undefined ? normalizeStatus(payload.status) : undefined,
    last_followup_type: payload.last_followup_type !== undefined
      ? normalizeFollowupType(payload.last_followup_type)
      : undefined,
    last_followup_at: payload.last_followup_at ?? undefined,
    followup_count: payload.followup_count ?? undefined,
    inactivity_reason: payload.inactivity_reason ?? undefined,
    crm_deals_outcome_id: payload.crm_deals_outcome_id !== undefined
      ? toNullableInt(payload.crm_deals_outcome_id)
      : undefined,
    source_module: payload.source_module !== undefined
      ? normalizeSourceModule(payload.source_module)
      : undefined,
    source_reference_id: payload.source_reference_id !== undefined
      ? toNullableInt(payload.source_reference_id)
      : undefined,
  };

  for (const [key, value] of Object.entries(allowed)) {
    if (value !== undefined) {
      fields.push(`${key} = $${idx++}`);
      values.push(value);
    }
  }

  fields.push(`updated_at = CURRENT_TIMESTAMP`);

  const sql = `
    UPDATE ${TABLE}
    SET ${fields.join(', ')}
    WHERE customer_id = $${idx}
    RETURNING *;
  `;

  values.push(customerId);
  const res = await pool.query(sql, values);
  return res.rows[0] || null;
}

export async function registerCustomerFollowup(customerId, {
  followup_type,
  inactivity_reason = null,
  status = null,
  crm_deals_outcome_id = null,
  source_module = null,
  source_reference_id = null,
} = {}) {
  const normalizedType = normalizeFollowupType(followup_type);
  const normalizedStatus = status ? normalizeStatus(status) : null;
  const normalizedOutcomeId = toNullableInt(crm_deals_outcome_id);
  const normalizedSourceModule = normalizeSourceModule(source_module);
  const normalizedSourceReferenceId = toNullableInt(source_reference_id);

  if (!normalizedType) {
    throw new Error('INVALID_FOLLOWUP_TYPE');
  }

  const sql = `
    UPDATE ${TABLE}
    SET
      last_followup_type = $1,
      last_followup_at = CURRENT_TIMESTAMP,
      last_contact_date = CURRENT_TIMESTAMP,
      followup_count = COALESCE(followup_count, 0) + 1,
      inactivity_reason = COALESCE($2, inactivity_reason),
      status = COALESCE($3, status),
      crm_deals_outcome_id = COALESCE($4, crm_deals_outcome_id),
      source_module = COALESCE($5, source_module),
      source_reference_id = COALESCE($6, source_reference_id),
      updated_at = CURRENT_TIMESTAMP
    WHERE customer_id = $7
    RETURNING *;
  `;

  const res = await pool.query(sql, [
    normalizedType,
    inactivity_reason,
    normalizedStatus,
    normalizedOutcomeId,
    normalizedSourceModule,
    normalizedSourceReferenceId,
    customerId,
  ]);

  return res.rows[0] || null;
}

export async function recalculateCustomerActivityStatuses() {
  const sql = `
    UPDATE ${TABLE}
    SET
      days_without_purchase = CASE
        WHEN last_purchase_date IS NULL THEN 999
        ELSE CURRENT_DATE - last_purchase_date
      END,
      status = CASE
        WHEN source_module = 'crmDeals' AND crm_deals_outcome_id IS NOT NULL
          THEN status
        WHEN last_purchase_date IS NULL THEN 'inactive'
        WHEN CURRENT_DATE - last_purchase_date >= 90 THEN 'lost'
        WHEN CURRENT_DATE - last_purchase_date >= 60 THEN 'inactive'
        WHEN CURRENT_DATE - last_purchase_date >= 30 THEN 'at_risk'
        ELSE 'active'
      END,
      updated_at = CURRENT_TIMESTAMP
    RETURNING
      id,
      customer_id,
      status,
      days_without_purchase;
  `;

  const res = await pool.query(sql);
  return {
    affectedRows: res.rowCount,
    rows: res.rows,
  };
}
