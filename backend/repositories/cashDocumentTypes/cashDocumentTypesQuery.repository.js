// ╔════════════════════════════════════════════════════════════════════╗
// ║ cashDocumentTypesQuery.repository.js — list / getById              ║
// ║ Tabela: public."cashDocumentTypes"                                 ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE } from './cashDocumentTypes.constants.js';
import { normalizeId, normalizeBoolean } from './cashDocumentTypes.sanitizers.js';

export async function listCashDocumentTypes(filters = {}) {
  const search = String(filters.search ?? '').trim();
  const activeOnly = normalizeBoolean(filters.activeOnly, false);
  const includeInactive = normalizeBoolean(filters.includeInactive, true);

  const values = [];
  const where = [];

  if (search) {
    values.push(`%${search}%`);
    where.push(`name ILIKE $${values.length}`);
  }

  if (activeOnly || !includeInactive) {
    where.push('is_active = TRUE');
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `
      SELECT id, name, is_active, created_at, updated_at
        FROM ${TABLE}
        ${whereSql}
       ORDER BY is_active DESC, name ASC, id ASC
    `,
    values
  );

  return rows;
}

export async function getCashDocumentTypeById(idValue) {
  const id = normalizeId(idValue);
  if (!id) return null;

  const { rows } = await pool.query(
    `
      SELECT id, name, is_active, created_at, updated_at
        FROM ${TABLE}
       WHERE id = $1
       LIMIT 1
    `,
    [id]
  );

  return rows[0] ?? null;
}
