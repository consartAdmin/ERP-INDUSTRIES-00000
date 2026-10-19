// ╔══════════════════════════════════════════════════════════════════════╗
// ║ userTablePreferencesQuery.repository.js — get / save / reset         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './userTablePreferences.constants.js';
import { ensureTable } from './userTablePreferencesSchema.repository.js';

/** Preferências do usuário para a tabela (null se nunca salvou). */
export async function get(userId, tableKey) {
  await ensureTable();
  const { rows } = await pool.query(
    `SELECT prefs, updated_at FROM ${TB} WHERE user_id = $1 AND table_key = $2;`,
    [userId, tableKey]
  );
  return rows[0] ?? null;
}

/** Salva (upsert) o objeto completo de preferências. */
export async function save(userId, tableKey, prefs) {
  await ensureTable();
  const { rows } = await pool.query(
    `INSERT INTO ${TB} (user_id, table_key, prefs)
     VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (user_id, table_key)
       DO UPDATE SET prefs = EXCLUDED.prefs, updated_at = NOW()
     RETURNING prefs, updated_at;`,
    [userId, tableKey, JSON.stringify(prefs ?? {})]
  );
  return rows[0];
}

/** Volta ao padrão (apaga as preferências salvas). */
export async function reset(userId, tableKey) {
  await ensureTable();
  await pool.query(`DELETE FROM ${TB} WHERE user_id = $1 AND table_key = $2;`, [userId, tableKey]);
}
