// ╔════════════════════════════════════════════════════════════════════╗
// ║ cashCategoriesQuery.repository.js — listar / obter por id          ║
// ║ Tabela: "cashCategories"                                           ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_CAIXA_CATEGORIAS } from './cashCategories.constants.js';
import { asInt } from './cashCategories.sanitizers.js';

export async function listarCategorias({ incluirInativos = true } = {}) {
  const where = incluirInativos ? '' : 'WHERE is_active = true';
  const sql = `
    SELECT id, nome, is_active, created_at, updated_at
      FROM ${TB_CAIXA_CATEGORIAS}
      ${where}
     ORDER BY nome ASC
  `;
  const { rows } = await pool.query(sql);
  return rows;
}

export async function obterCategoriaPorId(id) {
  const _id = asInt(id);
  if (!_id) return null;

  const sql = `
    SELECT id, nome, is_active, created_at, updated_at
      FROM ${TB_CAIXA_CATEGORIAS}
     WHERE id = $1
     LIMIT 1
  `;
  const { rows } = await pool.query(sql, [_id]);
  return rows[0] ?? null;
}
