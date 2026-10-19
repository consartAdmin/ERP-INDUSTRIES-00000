// ╔════════════════════════════════════════════════════════════════════╗
// ║ moduleSystemRemove.repository.js — remove / removeTestRecords      ║
// ║ Tabela: public."moduleSystem"                                      ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TABLE } from './moduleSystem.constants.js';
import { q } from './moduleSystem.utils.js';

/** Remove módulo por ID */
export async function remove(id) {
  const { rows } = await q(
    `
    DELETE FROM ${TABLE}
    WHERE id = $1
    RETURNING id, name, path;
  `,
    [Number(id)]
  );
  return rows[0] || null;
}

/** Remove módulos de teste (nome iniciando com 'TEST -') para cleanup */
export async function removeTestRecords() {
  const { rowCount } = await q(
    `
    DELETE FROM ${TABLE}
    WHERE name ILIKE 'TEST -%';
  `
  );
  return rowCount;
}
