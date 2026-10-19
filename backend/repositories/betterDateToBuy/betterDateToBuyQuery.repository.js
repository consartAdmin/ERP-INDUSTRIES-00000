// ╔════════════════════════════════════════════════════════════════════╗
// ║ betterDateToBuyQuery.repository.js — getAll / getById / today      ║
// ║ Tabela: "betterDateToBuy" (+ customers)                            ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';


// ──────────────────────────────────────────────────────────────────────
// GET ALL ALERTS
// ──────────────────────────────────────────────────────────────────────
export async function getAllBetterDates() {
  const sql = `
    SELECT
      b.better_date_to_buy_id,
      b.customer_id,
      b.alert_day,
      b.notes,
      b.status,
      b.last_alert_sent,
      b.created_at,
      b.updated_at,
      c.trade_name,
      c.legal_name,
      c.mobile_number
    FROM "betterDateToBuy" b
    LEFT JOIN customers c
      ON c.customer_id = b.customer_id
    ORDER BY
      b.alert_day ASC,
      c.trade_name ASC
  `;

  const { rows } = await pool.query(sql);

  return rows;
}


// ──────────────────────────────────────────────────────────────────────
// GET ONE ALERT
// ──────────────────────────────────────────────────────────────────────
export async function getBetterDateById(id) {
  const sql = `
    SELECT
      b.*,
      c.trade_name,
      c.legal_name,
      c.mobile_number
    FROM "betterDateToBuy" b
    LEFT JOIN customers c
      ON c.customer_id = b.customer_id
    WHERE
      b.better_date_to_buy_id = $1
  `;

  const { rows } = await pool.query(sql, [id]);

  return rows[0];
}


// ──────────────────────────────────────────────────────────────────────
// GET TODAY ALERTS
//
// Rules:
// 1. alert_day must match today's day
// 2. status must be active
// 3. must not have been sent this month
// ──────────────────────────────────────────────────────────────────────
export async function getTodayAlerts() {
  const sql = `
    SELECT
      b.better_date_to_buy_id,
      b.customer_id,
      b.alert_day,
      b.notes,
      b.status,
      b.last_alert_sent,
      c.trade_name,
      c.legal_name,
      c.mobile_number
    FROM "betterDateToBuy" b
    INNER JOIN customers c
      ON c.customer_id = b.customer_id
    WHERE
      b.status = 'active'

      AND b.alert_day =
        EXTRACT(DAY FROM CURRENT_DATE)

      AND (
        b.last_alert_sent IS NULL
        OR DATE_TRUNC('month', b.last_alert_sent)
           < DATE_TRUNC('month', CURRENT_DATE)
      )

    ORDER BY
      c.trade_name ASC
  `;

  const { rows } = await pool.query(sql);

  return rows;
}
