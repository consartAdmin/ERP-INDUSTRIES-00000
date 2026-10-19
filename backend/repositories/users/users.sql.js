// ╔════════════════════════════════════════════════════════════════════╗
// ║ users.sql.js — Fragmentos SQL (colunas, WHERE dinâmico)            ║
// ╚════════════════════════════════════════════════════════════════════╝

import { ALIAS, ALL_COLS } from './users.constants.js';

export const SELECT_COLS = ALL_COLS.map((c) => `${ALIAS}.${c}`).join(',\n        ');
export const RETURNING_COLS = ALL_COLS.join(', ');

/**
 * Monta WHERE + params dinamicamente
 * Filtros suportados:
 *   - q: busca em name/email
 *   - is_active: true/false
 *   - access_level: string
 */
export function buildWhereAndParams({ q, is_active, access_level } = {}) {
  const where = [];
  const params = [];

  if (q && String(q).trim()) {
    params.push(`%${String(q).trim()}%`);
    const p = `$${params.length}`;
    where.push(
      `(${ALIAS}.name ILIKE ${p} OR ${ALIAS}.email ILIKE ${p})`
    );
  }

  if (typeof is_active === 'boolean') {
    params.push(is_active);
    const p = `$${params.length}`;
    where.push(`${ALIAS}.is_active = ${p}`);
  }

  if (access_level && String(access_level).trim()) {
    params.push(String(access_level).trim());
    const p = `$${params.length}`;
    where.push(`${ALIAS}.access_level = ${p}`);
  }

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return { clause, params };
}
