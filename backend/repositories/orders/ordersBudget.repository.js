// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ordersBudget.repository.js — Loader de orçamento                     ║
// ║ loadBudgetFull / cliente / IBGE                                      ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_BUDGETS, TB_BUDGET_ITEMS, TB_CUSTOMERS, TB_CUSTOMERS_IBGE } from './orders.constants.js';
import { onlyDigits } from './orders.utils.js';

// ----------------------------------------------------------------------
// Budget loader
// ----------------------------------------------------------------------
export async function loadBudgetFull(budgetId) {
  const client = await pool.connect();

  try {
    const headSql = `
      SELECT *
      FROM ${TB_BUDGETS}
      WHERE budget_id = $1
    `;

    const headRes = await client.query(headSql, [budgetId]);

    if (!headRes.rowCount) {
      return null;
    }

    const itemsSql = `
      SELECT
        bi.budget_item_id,
        bi.budget_id,

        bi.product_code AS sku,
        bi.product_code,

        bi.barcode_id,
        bi.description,
        bi.manufacturer_ref,
        bi.grade_id,

        bi.unit_code AS unit,
        bi.unit_code,
        bi.conversion_factor,

        bi.quantity,
        bi.unit_price,
        bi.discount_value,

        bi.price_id,
        bi.commission_id,

        bi.lot_id,

        bi.override_stock,
        bi.override_token,
        bi.override_approved_at,
        bi.override_approved_by,
        bi.override_reason,
        bi.override_qty,
        bi.override_lot_id,

        bi.created_at,
        bi.updated_at

      FROM ${TB_BUDGET_ITEMS} bi

      WHERE bi.budget_id = $1

      ORDER BY bi.budget_item_id ASC
    `;

    const itemsRes = await client.query(itemsSql, [budgetId]);

    return {
      header: headRes.rows[0],
      items: itemsRes.rows,
    };
  } finally {
    client.release();
  }
}

export async function resolveCustomerIdByDoc(client, doc) {
  const d = onlyDigits(doc);
  if (!d) return null;

  const r = await client.query(
    `
    SELECT customer_id
    FROM ${TB_CUSTOMERS}
    WHERE REGEXP_REPLACE(COALESCE(tax_id, cnpj_cpf, ''), '\\D', '', 'g') = $1
    LIMIT 1
    `,
    [d],
  );

  return r.rows?.[0]?.customer_id ?? null;
}

export async function upsertCustomersIbgeFromCustomers(client, customerId) {
  if (!customerId) return;

  const exists = await client.query(
    `SELECT 1 FROM ${TB_CUSTOMERS_IBGE} WHERE customer_id = $1 LIMIT 1`,
    [customerId]
  );

  if (exists.rowCount) {
    await client.query(
      `
      UPDATE ${TB_CUSTOMERS_IBGE}
      SET source = 'orders-sync'::TEXT,
          confidence = 90::SMALLINT,
          updated_at = NOW()
      WHERE customer_id = $1
      `,
      [customerId]
    );
    return;
  }

  return;
}
