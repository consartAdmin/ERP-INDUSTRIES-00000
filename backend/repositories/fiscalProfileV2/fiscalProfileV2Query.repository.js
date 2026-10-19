// ╔════════════════════════════════════════════════════════════════════╗
// ║ fiscalProfileV2Query.repository.js — list / getById                ║
// ║ Tabela: public."fiscalProfileV2"                                   ║
// ╚════════════════════════════════════════════════════════════════════╝

import db from '../../config/db.js';
import { FISCAL_PROFILE_V2_PRIMARY_KEY as PRIMARY_KEY } from './fiscalProfileV2.catalog.js';
import { SELECT } from './fiscalProfileV2.sql.js';
import { parseBoolean, normalizePagination } from './fiscalProfileV2.sanitizers.js';

export async function list({ active, search, limit = 100, offset = 0 } = {}) {
  const values = [];
  const where = [];
  const pagination = normalizePagination(limit, offset);

  if (active !== undefined && active !== null && active !== '') {
    values.push(parseBoolean(active, 'active'));
    where.push(`fp.is_active = $${values.length}`);
  }

  const normalizedSearch = String(search ?? '').trim();
  if (normalizedSearch) {
    values.push(`%${normalizedSearch}%`);
    where.push(
      `(fp.profile_name ILIKE $${values.length} OR fp.description ILIKE $${values.length})`,
    );
  }

  values.push(pagination.limit, pagination.offset);

  const sql = `
    ${SELECT}
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY fp.profile_name
    LIMIT $${values.length - 1}
    OFFSET $${values.length}
  `;

  return (await db.query(sql, values)).rows;
}

export async function getById(id) {
  return (
    await db.query(`${SELECT} WHERE fp.${PRIMARY_KEY} = $1`, [id])
  ).rows[0] ?? null;
}
