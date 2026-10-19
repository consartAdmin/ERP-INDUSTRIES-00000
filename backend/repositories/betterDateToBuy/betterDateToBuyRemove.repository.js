// ╔════════════════════════════════════════════════════════════════════╗
// ║ betterDateToBuyRemove.repository.js — deleteBetterDate             ║
// ║ Tabela: "betterDateToBuy"                                          ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';


// ──────────────────────────────────────────────────────────────────────
// DELETE ALERT
// ──────────────────────────────────────────────────────────────────────
export async function deleteBetterDate(id) {
  const sql = `
    DELETE FROM "betterDateToBuy"
    WHERE better_date_to_buy_id = $1
  `;

  await pool.query(sql, [id]);
}
