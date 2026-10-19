// ╔══════════════════════════════════════════════════════════════════════╗
// ║ enterpriseCreate.repository.js — create                              ║
// ║ Tabela: enterprises                                                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { catalog_schema } from './enterprise.constants.js';
import { normalizePayload, validateRequired } from './enterprise.sanitizers.js';
import { ensureTable } from './enterpriseSchema.repository.js';
import { findByCnpj } from './enterpriseGetById.repository.js';

export async function create(payload = {}) {
  await ensureTable();

  const data = normalizePayload(payload);
  validateRequired(data);

  const existing = await findByCnpj(data.cnpj);
  if (existing) {
    throw new Error('There is already an enterprise with this CNPJ.');
  }

  const fields = catalog_schema.fields;
  const values = fields.map((field) => data[field] ?? null);
  const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');

  const { rows } = await pool.query(`
    INSERT INTO ${catalog_schema.table} (${fields.join(', ')})
    VALUES (${placeholders})
    RETURNING *
  `, values);

  return rows[0];
}
