// ╔════════════════════════════════════════════════════════════════════╗
// ║ googleAds.sql.js — Montagem de WHERE / ORDER BY do CRUD genérico   ║
// ╚════════════════════════════════════════════════════════════════════╝

import { getConfig } from './googleAds.utils.js';

export function buildWhereClause(resource, query = {}) {
  const { searchable } = getConfig(resource);
  const conditions = [];
  const values = [];
  let idx = 1;

  if (query.q && searchable.length) {
    const likeParts = searchable.map((field) => {
      values.push(`%${query.q}%`);
      return `CAST(${field} AS TEXT) ILIKE $${idx++}`;
    });
    conditions.push(`(${likeParts.join(' OR ')})`);
  }

  for (const [key, value] of Object.entries(query)) {
    if (
      ['q', 'page', 'limit', 'orderBy', 'orderDir'].includes(key) ||
      value === undefined ||
      value === null ||
      value === ''
    ) {
      continue;
    }

    const { allowedFields, pk } = getConfig(resource);
    if (!allowedFields.includes(key) && key !== pk) continue;

    values.push(value);
    conditions.push(`${key} = $${idx++}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where, values };
}

export function buildOrderClause(resource, orderBy, orderDir) {
  const { allowedFields, pk, defaultOrder } = getConfig(resource);
  if (!orderBy) return `ORDER BY ${defaultOrder}`;

  const allowedOrderFields = new Set([pk, ...allowedFields, 'created_at', 'updated_at']);
  if (!allowedOrderFields.has(orderBy)) return `ORDER BY ${defaultOrder}`;

  const dir = String(orderDir || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  return `ORDER BY ${orderBy} ${dir}`;
}
