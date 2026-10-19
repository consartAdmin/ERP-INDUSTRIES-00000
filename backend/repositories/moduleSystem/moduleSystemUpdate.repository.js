// ╔════════════════════════════════════════════════════════════════════╗
// ║ moduleSystemUpdate.repository.js — update                          ║
// ║ Tabela: public."moduleSystem"                                      ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TABLE, COLUMNS } from './moduleSystem.constants.js';
import { q } from './moduleSystem.utils.js';
import { findById } from './moduleSystemQuery.repository.js';

// Campos que podem ser atualizados (os booleanos são convertidos com !!)
const UPDATABLE = Object.freeze([
  'name', 'path', 'is_active', 'menu_type', 'parent_id', 'sort_order',
  'html_id', 'css_class', 'feature', 'is_external', 'is_public',
]);
const BOOLEANS = new Set(['is_active', 'is_external', 'is_public']);

/** Atualiza módulo por ID (só os campos presentes no payload) */
export async function update(id, payload = {}) {
  const fields = [];
  const params = [];

  UPDATABLE.forEach((column) => {
    if (payload[column] === undefined) return;
    params.push(BOOLEANS.has(column) ? !!payload[column] : payload[column]);
    fields.push(`${column} = $${params.length}`);
  });

  if (!fields.length) {
    // nada para atualizar
    return findById(id);
  }

  params.push(Number(id));

  const sql = `
    UPDATE ${TABLE}
    SET ${fields.join(', ')},
        updated_at = now()
    WHERE id = $${params.length}
    RETURNING ${COLUMNS};
  `;

  const { rows } = await q(sql, params);
  return rows[0] || null;
}
