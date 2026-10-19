// ╔════════════════════════════════════════════════════════════════════╗
// ║ cashSubcategoriesRemove.repository.js — excluirSubcategoria        ║
// ║ Tabela: "cashSubcategories"                                        ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_CAIXA_SUBCATEGORIAS } from './cashSubcategories.constants.js';
import { asInt } from './cashSubcategories.sanitizers.js';

export async function excluirSubcategoria(id) {
  const _id = asInt(id);
  if (!_id) {
    const e = new Error('ID inválido.');
    e.statusCode = 400;
    throw e;
  }

  const sql = `DELETE FROM ${TB_CAIXA_SUBCATEGORIAS} WHERE id = $1 RETURNING id`;
  const { rows } = await pool.query(sql, [_id]);
  return rows[0] ?? null;
}
