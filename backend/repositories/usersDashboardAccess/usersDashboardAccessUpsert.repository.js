// ╔════════════════════════════════════════════════════════════════════╗
// ║ usersDashboardAccessUpsert.repository.js — upsert / replace        ║
// ║ Tabela: public."usersDashboardAccess"                              ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE } from './usersDashboardAccess.constants.js';

export async function upsertUserDashboardAccess({
  userId,
  dashboardKey,
  canView,
}) {
  const { rows } = await pool.query(
    `
      INSERT INTO ${TABLE} (
        user_id,
        dashboard_key,
        can_view
      )
      VALUES ($1, $2, $3)

      ON CONFLICT (user_id, dashboard_key)
      DO UPDATE SET
        can_view = EXCLUDED.can_view,
        updated_at = NOW()

      RETURNING
        id,
        user_id,
        dashboard_key,
        can_view,
        created_at,
        updated_at
    `,
    [userId, dashboardKey, canView]
  );

  return rows[0];
}

export async function replaceUserDashboardAccess(userId, dashboards = []) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `DELETE FROM ${TABLE} WHERE user_id = $1`,
      [userId]
    );

    const inserted = [];

    for (const item of dashboards) {
      const { rows } = await client.query(
        `
          INSERT INTO ${TABLE} (
            user_id,
            dashboard_key,
            can_view
          )
          VALUES ($1, $2, $3)

          RETURNING
            id,
            user_id,
            dashboard_key,
            can_view,
            created_at,
            updated_at
        `,
        [
          userId,
          item.dashboardKey,
          item.canView,
        ]
      );

      inserted.push(rows[0]);
    }

    await client.query('COMMIT');

    return inserted;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
