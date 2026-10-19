// ╔════════════════════════════════════════════════════════════════════╗
// ║ cashCategoriesRemove.repository.js — excluirCategoria              ║
// ║ Tabela: "cashCategories"                                           ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_CAIXA_CATEGORIAS } from './cashCategories.constants.js';
import { asInt } from './cashCategories.sanitizers.js';

export async function excluirCategoria(id) {
  const _id = asInt(id);
  if (!_id) {
    const e = new Error('ID inválido.');
    e.statusCode = 400;
    throw e;
  }

  // ON DELETE CASCADE na subcategoria já cuida das dependências.
  const sql = `DELETE FROM ${TB_CAIXA_CATEGORIAS} WHERE id = $1 RETURNING id`;
  const { rows } = await pool.query(sql, [_id]);
  return rows[0] ?? null;
}
