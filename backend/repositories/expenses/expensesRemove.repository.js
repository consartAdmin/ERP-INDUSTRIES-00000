// ╔════════════════════════════════════════════════════════════════════╗
// ║ expensesRemove.repository.js — deleteExpense                       ║
// ║ Tabela: public."Expenses"                                          ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './expenses.constants.js';

export async function deleteExpense(id) {
  const q = `DELETE FROM ${TB} WHERE "id" = $1 RETURNING "id";`;
  const { rows } = await pool.query(q, [id]);
  return rows[0] || null;
}
