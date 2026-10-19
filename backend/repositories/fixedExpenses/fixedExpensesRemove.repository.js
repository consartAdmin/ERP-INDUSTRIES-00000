// ╔════════════════════════════════════════════════════════════════════╗
// ║ fixedExpensesRemove.repository.js — remove                         ║
// ║ Tabela: "fixedExpenses"                                            ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TABLE } from './fixedExpenses.constants.js';
import { q } from './fixedExpenses.sql.js';

/** Remove */
export async function remove(id) {
  const { rows } = await q(
    `DELETE FROM ${TABLE} WHERE id = $1::uuid RETURNING id`,
    [String(id).trim()],
  );
  return !!rows[0];
}
