// ╔════════════════════════════════════════════════════════════════════╗
// ║ usersDashboardAccessQuery.repository.js — list / get /             ║
// ║ canUserViewDashboard                                               ║
// ║ Tabela: public."usersDashboardAccess"                              ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE } from './usersDashboardAccess.constants.js';

export async function listUserDashboardAccess(userId) {
  const { rows } = await pool.query(
    `
      SELECT
        id,
        user_id,
        dashboard_key,
        can_view,
        created_at,
        updated_at
      FROM ${TABLE}
      WHERE user_id = $1
      ORDER BY dashboard_key ASC
    `,
    [userId]
  );

  return rows;
}

export async function getUserDashboardAccess(userId, dashboardKey) {
  const { rows } = await pool.query(
    `
      SELECT
        id,
        user_id,
        dashboard_key,
        can_view,
        created_at,
        updated_at
      FROM ${TABLE}
      WHERE user_id = $1
        AND dashboard_key = $2
      LIMIT 1
    `,
    [userId, dashboardKey]
  );

  return rows[0] || null;
}

export async function canUserViewDashboard(userId, dashboardKey) {
  const row = await getUserDashboardAccess(userId, dashboardKey);

  return row?.can_view === true;
}
