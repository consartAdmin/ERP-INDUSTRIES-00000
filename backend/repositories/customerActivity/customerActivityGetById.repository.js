// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerActivityGetById.repository.js — leitura por id/customer_id ║
// ║ Inclui resolução de customer_id (customer_id ou cliente_id)        ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE } from './customerActivity.constants.js';
import { toNullableInt } from './customerActivity.sanitizers.js';

/* =========================================================================
 * HELPERS — CUSTOMER ID RESOLUTION
 * ========================================================================= */
export async function resolveCustomerActivityCustomerId(rawCustomerId) {
  const id = toNullableInt(rawCustomerId);
  if (!id) return null;

  let res = await pool.query(
    `SELECT customer_id FROM public.customers WHERE customer_id = $1 LIMIT 1`,
    [id]
  );
  if (res.rowCount) return res.rows[0].customer_id;

  res = await pool.query(
    `SELECT customer_id FROM public.customers WHERE cliente_id = $1 LIMIT 1`,
    [id]
  );
  if (res.rowCount) return res.rows[0].customer_id;

  return null;
}

export async function getCustomerActivityByCustomerId(customerId) {
  const sql = `
    SELECT
      ca.*,

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
    WHERE ca.customer_id = $1
    LIMIT 1;
  `;

  const res = await pool.query(sql, [customerId]);
  return res.rows[0] || null;
}

export async function getCustomerActivityById(id) {
  const sql = `
    SELECT *
    FROM ${TABLE}
    WHERE id = $1
    LIMIT 1;
  `;
  const res = await pool.query(sql, [id]);
  return res.rows[0] || null;
}
