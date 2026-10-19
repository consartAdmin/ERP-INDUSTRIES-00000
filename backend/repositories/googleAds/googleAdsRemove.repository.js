// ╔════════════════════════════════════════════════════════════════════╗
// ║ googleAdsRemove.repository.js — remove (CRUD genérico)             ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { getConfig } from './googleAds.utils.js';

export async function remove(resource, id) {
  const { table, pk } = getConfig(resource);

  const sql = `
    DELETE FROM ${table}
     WHERE ${pk} = $1
     RETURNING *
  `;

  const { rows } = await pool.query(sql, [id]);
  return rows[0] || null;
}
