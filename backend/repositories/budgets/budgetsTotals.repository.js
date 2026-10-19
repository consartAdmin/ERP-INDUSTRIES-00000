// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsTotals.repository.js — getTotals                              ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { BUDGETS_PRIMARY_KEY } from './budgets.catalog.js';
import {
  TB_BUDGETS,
  TB_BUDGET_ITEMS,
  TB_BUDGETS_SHIPPING,
} from './budgets.constants.js';

// ----------------------------------------------------------------------
// Totals
// ----------------------------------------------------------------------
export async function getTotals(budgetId) {
  const bid = Number(budgetId);
  if (!Number.isFinite(bid) || bid <= 0) {
    return { ok: false, error: 'BAD_REQUEST' };
  }

  const sql = `
      SELECT
        b.subtotal,
        b.items_discount_total,
        b.total_discount,
        b.global_discount_type,
        b.global_discount_value,
        b.global_discount_amount,
        COALESCE(bs.freight_value, 0) AS freight_value,
        b.total_amount,
        (
          SELECT COUNT(*)
          FROM ${TB_BUDGET_ITEMS} i
          WHERE i.budget_id = b.budget_id
        ) AS items_count
      FROM ${TB_BUDGETS} b
      LEFT JOIN ${TB_BUDGETS_SHIPPING} bs
        ON bs.budget_shipping_id = b.budget_shipping_id
      WHERE b.${BUDGETS_PRIMARY_KEY} = $1
      LIMIT 1
    `;
  const r = await pool.query(sql, [bid]);
  const row = r.rows?.[0];

  if (!row) {
    return { ok: false, error: 'NOT_FOUND' };
  }

  return {
    ok: true,
    items_count: Number(row?.items_count || 0),
    subtotal: Number(row?.subtotal || 0),
    items_discount_total: Number(row?.items_discount_total || 0),
    total_discount: Number(row?.total_discount || 0),
    global_discount_type: row?.global_discount_type || 'value',
    global_discount_value: Number(row?.global_discount_value || 0),
    global_discount_amount: Number(row?.global_discount_amount || 0),
    freight_value: Number(row?.freight_value || 0),
    total_amount: Number(row?.total_amount || 0),
  };
}
