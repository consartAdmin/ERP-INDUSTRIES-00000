// ╔════════════════════════════════════════════════════════════════════╗
// ║ cashCategoriesCreate.repository.js — criarCategoria                ║
// ║ Tabela: "cashCategories"                                           ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_CAIXA_CATEGORIAS } from './cashCategories.constants.js';
import { safeStr, asBool } from './cashCategories.sanitizers.js';
import { isUniqueViolation } from './cashCategories.utils.js';

export async function criarCategoria({ nome, is_active = true }) {
  const _nome = safeStr(nome, 100);
  const _active = asBool(is_active, true);

  if (!_nome) {
    const e = new Error('Nome da categoria é obrigatório.');
    e.statusCode = 400;
    throw e;
  }

  const sql = `
    INSERT INTO ${TB_CAIXA_CATEGORIAS} (nome, is_active)
    VALUES ($1, $2)
    RETURNING id, nome, is_active, created_at, updated_at
  `;

  try {
    const { rows } = await pool.query(sql, [_nome, _active]);
    return rows[0];
  } catch (err) {
    if (isUniqueViolation(err)) {
      const e = new Error('Já existe uma categoria com este nome.');
      e.statusCode = 409;
      e.cause = err;
      throw e;
    }
    throw err;
  }
}
