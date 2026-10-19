// ╔════════════════════════════════════════════════════════════════════╗
// ║ moduleSystemQuery.repository.js — list / findById / countChildren  ║
// ║ Tabela: public."moduleSystem"                                      ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TABLE, COLUMNS } from './moduleSystem.constants.js';
import { q } from './moduleSystem.utils.js';

/**
 * Lista módulos.
 * Filtros:
 *  - onlyActive: true → só módulos ativos
 *  - search: termo do nome ou path
 * Cada linha traz parent_name (nome do item pai no menu).
 */
export async function list({ onlyActive = false, search } = {}) {
  const where = [];
  const params = [];

  if (onlyActive) {
    where.push('m.is_active = true');
  }

  if (search) {
    params.push(`%${search}%`);
    params.push(`%${search}%`);
    where.push(`(m.name ILIKE $${params.length - 1} OR m.path ILIKE $${params.length})`);
  }

  const sql = `
    SELECT ${COLUMNS.replace(/(\w+)/g, 'm.$1')}, p.name AS parent_name
    FROM ${TABLE} m
    LEFT JOIN ${TABLE} p ON p.id = m.parent_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY m.id ASC;
  `;

  const { rows } = await q(sql, params);
  return rows;
}

/** Busca módulo por ID */
export async function findById(id) {
  const { rows } = await q(
    `
    SELECT ${COLUMNS}
    FROM ${TABLE}
    WHERE id = $1;
  `,
    [Number(id)]
  );
  return rows[0] || null;
}

/** Filhos diretos de um item do menu (para validar hierarquia/exclusão) */
export async function listChildren(id) {
  const { rows } = await q(
    `
    SELECT id, name, menu_type
    FROM ${TABLE}
    WHERE parent_id = $1;
  `,
    [Number(id)]
  );
  return rows;
}
