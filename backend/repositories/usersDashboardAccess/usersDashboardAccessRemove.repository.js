// ╔════════════════════════════════════════════════════════════════════╗
// ║ usersDashboardAccessRemove.repository.js — delete / deleteAll      ║
// ║ Tabela: public."usersDashboardAccess"                              ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE } from './usersDashboardAccess.constants.js';

export async function deleteUserDashboardAccess(userId, dashboardKey) {
  const result = await pool.query(
    `
      DELETE FROM ${TABLE}
      WHERE user_id = $1
        AND dashboard_key = $2
    `,
    [userId, dashboardKey]
  );

  return result.rowCount > 0;
}

export async function deleteAllUserDashboardAccess(userId) {
  const result = await pool.query(
    `
      DELETE FROM ${TABLE}
      WHERE user_id = $1
    `,
    [userId]
  );

  return result.rowCount;
}
