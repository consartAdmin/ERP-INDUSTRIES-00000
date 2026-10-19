// ╔════════════════════════════════════════════════════════════════════╗
// ║ fiscalClassificationV2Query.repository.js — list / getById         ║
// ║ Tabela: public."fiscalClassificationV2"                            ║
// ╚════════════════════════════════════════════════════════════════════╝

import db from '../../config/db.js';
import { FISCAL_CLASSIFICATION_V2_PRIMARY_KEY as PRIMARY_KEY } from './fiscalClassificationV2.catalog.js';
import { SELECT } from './fiscalClassificationV2.sql.js';
import { parseBoolean, normalizePagination, normalizeDigits } from './fiscalClassificationV2.sanitizers.js';

export async function list({ active, search, ncm, cest, limit = 100, offset = 0 } = {}) {
  const values = [];
  const where = [];
  const pagination = normalizePagination(limit, offset);
  const add = (clause, value) => {
    values.push(value);
    where.push(clause.replace('?', `$${values.length}`));
  };

  if (active !== undefined && active !== null && active !== '') {
    add('fc.is_active = ?', parseBoolean(active, 'active'));
  }

  const normalizedSearch = String(search ?? '').trim();
  if (normalizedSearch) {
    values.push(`%${normalizedSearch}%`);
    where.push(`(
      fc.classification_name ILIKE $${values.length}
      OR fc.description ILIKE $${values.length}
      OR fc.ncm_description ILIKE $${values.length}
      OR fc.cest_description ILIKE $${values.length}
      OR fp.profile_name ILIKE $${values.length}
    )`);
  }

  if (ncm !== undefined && ncm !== null && ncm !== '') {
    add("regexp_replace(fc.ncm_code, '[^0-9]', '', 'g') = ?", normalizeDigits(ncm, 8, 'ncm'));
  }
  if (cest !== undefined && cest !== null && cest !== '') {
    add("regexp_replace(fc.cest_code, '[^0-9]', '', 'g') = ?", normalizeDigits(cest, 7, 'cest'));
  }

  values.push(pagination.limit, pagination.offset);
  const sql = `
    ${SELECT}
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY fc.classification_name
    LIMIT $${values.length - 1}
    OFFSET $${values.length}
  `;
  return (await db.query(sql, values)).rows;
}

export async function getById(id) {
  return (await db.query(`${SELECT} WHERE fc.${PRIMARY_KEY} = $1`, [id])).rows[0] ?? null;
}
