// ╔════════════════════════════════════════════════════════════════════╗
// ║ fixedExpenses.sql.js — Execução de query, ORDER BY e WHERE         ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';

/** Execução básica de query */
export async function q(text, params = []) {
  // console.debug('[SQL]', text, params);
  return pool.query(text, params);
}

/** Ordenação segura (colunas permitidas) */
export function parseOrder(orderBy, allowed = []) {
  if (!orderBy) return '';
  const [col, dirRaw] = String(orderBy).trim().split(/\s+/);
  const colSafe = allowed.includes(col) ? col : null;
  const dir = /^(asc|desc)$/i.test(dirRaw || '') ? dirRaw.toUpperCase() : 'ASC';
  return colSafe ? ` ORDER BY ${colSafe} ${dir} ` : '';
}

/** WHERE dinâmico p/ listagem */
export function buildWhere(filters = {}) {
  const { search, report_name, date_from, date_to, customer_id } = filters;
  const where = [];
  const params = [];

  if (customer_id) {
    params.push(String(customer_id).trim());
    where.push(`customer_id = $${params.length}::uuid`);
  }

  if (report_name) {
    params.push(`%${String(report_name).trim()}%`);
    where.push(`report_name ILIKE $${params.length}`);
  }

  if (search) {
    params.push(`%${String(search).trim()}%`);
    const i = params.length;
    where.push(`(report_name ILIKE $${i} OR payload::text ILIKE $${i})`);
  }

  if (date_from) {
    params.push(date_from);
    where.push(`created_at >= $${params.length}`);
  }

  if (date_to) {
    params.push(date_to);
    where.push(`created_at < $${params.length}`);
  }

  return { sql: where.length ? ` WHERE ${where.join(' AND ')} ` : '', params };
}
