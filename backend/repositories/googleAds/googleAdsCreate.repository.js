// ╔════════════════════════════════════════════════════════════════════╗
// ║ googleAdsCreate.repository.js — create (CRUD genérico)             ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { getConfig } from './googleAds.utils.js';
import { sanitizeFields } from './googleAds.sanitizers.js';

export async function create(resource, payload) {
  const { table, pk } = getConfig(resource);
  const data = sanitizeFields(resource, payload);

  const fields = Object.keys(data);
  if (!fields.length) {
    const err = new Error('Nenhum campo válido foi informado para criação.');
    err.statusCode = 400;
    throw err;
  }

  const values = Object.values(data);
  const placeholders = values.map((_, i) => `$${i + 1}`);

  const sql = `
    INSERT INTO ${table} (${fields.join(', ')})
    VALUES (${placeholders.join(', ')})
    RETURNING *
  `;

  const { rows } = await pool.query(sql, values);
  return rows[0] || null;
}
