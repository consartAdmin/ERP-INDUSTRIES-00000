// ╔════════════════════════════════════════════════════════════════════╗
// ║ googleAdsUpdate.repository.js — update (CRUD genérico)             ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { getConfig } from './googleAds.utils.js';
import { sanitizeFields } from './googleAds.sanitizers.js';

export async function update(resource, id, payload) {
  const { table, pk } = getConfig(resource);
  const data = sanitizeFields(resource, payload);

  const fields = Object.keys(data);
  if (!fields.length) {
    const err = new Error('Nenhum campo válido foi informado para atualização.');
    err.statusCode = 400;
    throw err;
  }

  const setClause = fields
    .map((field, i) => `${field} = $${i + 1}`)
    .join(', ');

  const values = [...fields.map((f) => data[f]), id];

  const hasUpdatedAt = true;

  const sql = `
    UPDATE ${table}
       SET ${setClause}${hasUpdatedAt ? ', updated_at = NOW()' : ''}
     WHERE ${pk} = $${values.length}
     RETURNING *
  `;

  const { rows } = await pool.query(sql, values);
  return rows[0] || null;
}
