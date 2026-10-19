// ╔════════════════════════════════════════════════════════════════════╗
// ║ cashSubcategoriesCreate.repository.js — criarSubcategoria          ║
// ║ Tabela: "cashSubcategories"                                        ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_CAIXA_SUBCATEGORIAS } from './cashSubcategories.constants.js';
import { asInt, safeStr, asBool } from './cashSubcategories.sanitizers.js';
import { isUniqueViolation } from './cashSubcategories.utils.js';

export async function criarSubcategoria({ categoria_id, nome, is_active = true }) {
  const _categoriaId = asInt(categoria_id);
  const _nome = safeStr(nome, 100);
  const _active = asBool(is_active, true);

  if (!_categoriaId) {
    const e = new Error('categoria_id é obrigatório.');
    e.statusCode = 400;
    throw e;
  }
  if (!_nome) {
    const e = new Error('Nome da subcategoria é obrigatório.');
    e.statusCode = 400;
    throw e;
  }

  const sql = `
    INSERT INTO ${TB_CAIXA_SUBCATEGORIAS} (categoria_id, nome, is_active)
    VALUES ($1, $2, $3)
    RETURNING id, categoria_id, nome, is_active, created_at, updated_at
  `;

  try {
    const { rows } = await pool.query(sql, [_categoriaId, _nome, _active]);
    return rows[0];
  } catch (err) {
    if (isUniqueViolation(err)) {
      const e = new Error('Já existe uma subcategoria com este nome dentro desta categoria.');
      e.statusCode = 409;
      e.cause = err;
      throw e;
    }
    throw err;
  }
}
