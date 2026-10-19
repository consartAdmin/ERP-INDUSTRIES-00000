// ╔══════════════════════════════════════════════════════════════════════╗
// ║ enterpriseUpdate.repository.js — update / setActive                  ║
// ║ Tabela: enterprises                                                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { catalog_schema } from './enterprise.constants.js';
import { normalizeBoolean, normalizePayload, validateRequired } from './enterprise.sanitizers.js';
import { ensureTable } from './enterpriseSchema.repository.js';
import { findById, findByCnpj } from './enterpriseGetById.repository.js';

export async function update(id, payload = {}) {
  await ensureTable();

  const current = await findById(id);
  if (!current) {
    throw new Error('Enterprise not found.');
  }

  const data = normalizePayload({ ...current, ...payload });
  validateRequired(data);

  const existing = await findByCnpj(data.cnpj);
  if (existing && Number(existing.id) !== Number(id)) {
    throw new Error('There is already another enterprise with this CNPJ.');
  }

  const fields = catalog_schema.fields;
  const setSql = fields.map((field, i) => `${field} = $${i + 1}`).join(', ');
  const values = fields.map((field) => data[field] ?? null);

  values.push(id);

  const { rows } = await pool.query(`
    UPDATE ${catalog_schema.table}
    SET ${setSql},
        updated_at = NOW()
    WHERE id = $${values.length}
    RETURNING *
  `, values);

  return rows[0];
}

export async function setActive(id, isActive) {
  await ensureTable();

  const { rows } = await pool.query(`
    UPDATE ${catalog_schema.table}
    SET is_active = $1,
        updated_at = NOW()
    WHERE id = $2
    RETURNING *
  `, [normalizeBoolean(isActive), id]);

  return rows[0] || null;
}
