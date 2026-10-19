// ╔════════════════════════════════════════════════════════════════════╗
// ║ betterDateToBuyCreate.repository.js — createBetterDate             ║
// ║ Tabela: "betterDateToBuy"                                          ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';


// ──────────────────────────────────────────────────────────────────────
// CREATE ALERT
// ──────────────────────────────────────────────────────────────────────
export async function createBetterDate(data) {
  const sql = `
    INSERT INTO "betterDateToBuy" (
      customer_id,
      alert_day,
      notes,
      status
    )
    VALUES (
      $1,
      $2,
      $3,
      'active'
    )
    RETURNING *
  `;

  const params = [
    data.customer_id,
    data.alert_day,
    data.notes || null
  ];

  const { rows } = await pool.query(sql, params);

  return rows[0];
}
