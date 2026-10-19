// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerActivityCrmOutcome.repository.js — aplica outcome do CRM   ║
// ║ Tabelas: "customerActivity", "crmDealsOutcomes"                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE } from './customerActivity.constants.js';
import { toNullableInt } from './customerActivity.sanitizers.js';
import { mapOutcomeToStatus } from './customerActivity.utils.js';
import {
  resolveCustomerActivityCustomerId,
  getCustomerActivityByCustomerId,
} from './customerActivityGetById.repository.js';
import { createCustomerActivityIfMissing } from './customerActivityCreate.repository.js';

export async function applyCrmOutcomeToCustomerActivity({
  customerId,
  outcomeId,
  dealId,
}) {
  const rawCustomerId = toNullableInt(customerId);
  const normalizedOutcomeId = toNullableInt(outcomeId);
  const normalizedDealId = toNullableInt(dealId);

  if (!rawCustomerId) throw new Error('INVALID_CUSTOMER_ID');
  if (!normalizedOutcomeId) throw new Error('INVALID_OUTCOME_ID');
  if (!normalizedDealId) throw new Error('INVALID_DEAL_ID');

  const normalizedCustomerId = await resolveCustomerActivityCustomerId(rawCustomerId);
  if (!normalizedCustomerId) {
    throw new Error('CUSTOMER_NOT_FOUND_IN_CUSTOMERS');
  }

  const ensured = await createCustomerActivityIfMissing(normalizedCustomerId);
  if (!ensured && !(await getCustomerActivityByCustomerId(normalizedCustomerId))) {
    throw new Error('CUSTOMER_ACTIVITY_NOT_FOUND');
  }

  const outcomeRes = await pool.query(`
    SELECT id, code, name, outcome_type
    FROM "crmDealsOutcomes"
    WHERE id = $1
    LIMIT 1
  `, [normalizedOutcomeId]);

  const outcome = outcomeRes.rows[0];
  if (!outcome) {
    throw new Error('OUTCOME_NOT_FOUND');
  }

  const normalizedCode = String(outcome.code || '').trim().toLowerCase();
  const normalizedType = String(outcome.outcome_type || '').trim().toLowerCase();

  const newStatus = mapOutcomeToStatus(outcome.code, outcome.outcome_type);

  const isConversion =
    [
      'won_sale',
      'conversion',
      'won',
      'venda',
      'conversion_sale',
      'conversao_em_vendas',
      'conversão em vendas',
    ].includes(normalizedCode) ||
    ['conversion', 'won'].includes(normalizedType);

  const sql = `
    UPDATE ${TABLE}
    SET
      status = COALESCE($1, status),
      crm_deals_outcome_id = $2,
      source_module = 'crmDeals',
      source_reference_id = $3,
      last_contact_date = CURRENT_TIMESTAMP,
      inactivity_reason = CASE
        WHEN $4 THEN NULL
        ELSE COALESCE($5, inactivity_reason)
      END,
      last_purchase_date = CASE
        WHEN $4 THEN CURRENT_DATE
        ELSE last_purchase_date
      END,
      days_without_purchase = CASE
        WHEN $4 THEN 0
        ELSE days_without_purchase
      END,
      updated_at = CURRENT_TIMESTAMP
    WHERE customer_id = $6
    RETURNING *;
  `;

  const res = await pool.query(sql, [
    newStatus,
    outcome.id,
    normalizedDealId,
    isConversion,
    outcome.code || outcome.name || null,
    normalizedCustomerId,
  ]);

  return res.rows[0] || null;
}
