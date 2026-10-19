// ╔════════════════════════════════════════════════════════════════════╗
// ║ betterDateToBuyUpdate.repository.js — update / markAlertSent       ║
// ║ Tabela: "betterDateToBuy"                                          ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';


// ──────────────────────────────────────────────────────────────────────
// UPDATE ALERT
// ──────────────────────────────────────────────────────────────────────
export async function updateBetterDate(id, data) {
  const sql = `
    UPDATE "betterDateToBuy"
    SET
      customer_id = $1,
      alert_day = $2,
      notes = $3,
      status = $4,
      updated_at = NOW()
    WHERE
      better_date_to_buy_id = $5
    RETURNING *
  `;

  const params = [
    data.customer_id,
    data.alert_day,
    data.notes || null,
    data.status || 'active',
    id
  ];

  const { rows } = await pool.query(sql, params);

  return rows[0];
}


// ──────────────────────────────────────────────────────────────────────
// MARK ALERT AS SENT
// Prevent duplicate alerts in same month
// ──────────────────────────────────────────────────────────────────────
export async function markAlertSent(id) {
  const sql = `
    UPDATE "betterDateToBuy"
    SET
      last_alert_sent = CURRENT_DATE,
      updated_at = NOW()
    WHERE
      better_date_to_buy_id = $1
    RETURNING *
  `;

  const { rows } = await pool.query(sql, [id]);

  return rows[0];
}
