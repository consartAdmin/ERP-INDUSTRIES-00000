// ╔════════════════════════════════════════════════════════════════════╗
// ║ expenses.sql.js — ORDER BY seguro e WHERE dinâmico                 ║
// ╚════════════════════════════════════════════════════════════════════╝

import { normalizeBool } from './expenses.utils.js';

/** Permite apenas ORDER BY seguro */
export function safeOrderBy(input) {
  const allowed = new Map([
    ['created_at_desc', '"created_at" DESC'],
    ['created_at_asc', '"created_at" ASC'],
    ['due_date_desc', '"due_date" DESC'],
    ['due_date_asc', '"due_date" ASC'],
    ['updated_at_desc', '"update_at" DESC'], // sua coluna está "update_at"
    ['updated_at_asc', '"update_at" ASC'],
    ['value_desc', '"value" DESC'],
    ['value_asc', '"value" ASC'],
    ['name_asc', '"name" ASC'],
    ['name_desc', '"name" DESC'],
  ]);
  return allowed.get(String(input || '').toLowerCase()) || '"created_at" DESC';
}

/** Monta WHERE dinâmico com parâmetros */
export function buildWhere(filters = {}) {
  const where = [];
  const params = [];
  let i = 1;

  // Busca geral (name/description/expense_id/vendor/category)
  if (filters.q) {
    params.push(`%${String(filters.q).trim()}%`);
    where.push(`(
      "name" ILIKE $${i}
      OR COALESCE("description",'') ILIKE $${i}
      OR COALESCE("expense_id",'') ILIKE $${i}
      OR COALESCE("vendor",'') ILIKE $${i}
      OR COALESCE("category",'') ILIKE $${i}
    )`);
    i++;
  }

  if (filters.name) {
    params.push(`%${String(filters.name).trim()}%`);
    where.push(`"name" ILIKE $${i++}`);
  }

  if (filters.status) {
    params.push(String(filters.status).trim().toUpperCase());
    where.push(`"status" = $${i++}`);
  }

  if (filters.category) {
    params.push(String(filters.category).trim());
    where.push(`"category" = $${i++}`);
  }

  if (filters.vendor) {
    params.push(String(filters.vendor).trim());
    where.push(`"vendor" = $${i++}`);
  }

  const isActive = normalizeBool(filters.is_active);
  if (isActive !== undefined) {
    params.push(isActive);
    where.push(`"is_active" = $${i++}`);
  }

  if (filters.date_from) {
    params.push(filters.date_from);
    where.push(`"due_date" >= $${i++}::date`);
  }

  if (filters.date_to) {
    params.push(filters.date_to);
    where.push(`"due_date" <= $${i++}::date`);
  }

  const sql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return { sql, params };
}
