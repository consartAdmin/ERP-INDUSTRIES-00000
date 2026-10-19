// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerActivityCreate.repository.js — createIfMissing             ║
// ║ Tabela: "customerActivity"                                         ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE } from './customerActivity.constants.js';
import { getCustomerActivityByCustomerId } from './customerActivityGetById.repository.js';

export async function createCustomerActivityIfMissing(customerId) {
  const sql = `
    INSERT INTO ${TABLE} (
      customer_id,
      last_purchase_date,
      last_contact_date,
      days_without_purchase,
      status,
      last_followup_type,
      last_followup_at,
      followup_count,
      inactivity_reason,
      crm_deals_outcome_id,
      source_module,
      source_reference_id
    )
    SELECT
      $1,
      NULL,
      NULL,
      0,
      'active',
      NULL,
      NULL,
      0,
      NULL,
      NULL,
      NULL,
      NULL
    WHERE NOT EXISTS (
      SELECT 1
      FROM ${TABLE}
      WHERE customer_id = $1
    )
    RETURNING *;
  `;

  const inserted = await pool.query(sql, [customerId]);
  if (inserted.rows[0]) return inserted.rows[0];

  return getCustomerActivityByCustomerId(customerId);
}
