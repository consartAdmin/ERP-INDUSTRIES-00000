// ╔════════════════════════════════════════════════════════════════════╗
// ║ cashSubcategoriesQuery.repository.js — listar / por categoria / id ║
// ║ Tabela: "cashSubcategories"                                        ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_CAIXA_SUBCATEGORIAS } from './cashSubcategories.constants.js';
import { asInt } from './cashSubcategories.sanitizers.js';

export async function listarSubcategorias({ incluirInativos = true } = {}) {
  const where = incluirInativos ? '' : 'WHERE is_active = true';

  const sql = `
    SELECT id, categoria_id, nome, is_active, created_at, updated_at
      FROM ${TB_CAIXA_SUBCATEGORIAS}
      ${where}
     ORDER BY nome ASC
  `;
  const { rows } = await pool.query(sql);
  return rows;
}

export async function listarSubcategoriasPorCategoria(categoriaId, { incluirInativos = true } = {}) {
  const _categoriaId = asInt(categoriaId);
  if (!_categoriaId) {
    const e = new Error('categoria_id inválido.');
    e.statusCode = 400;
    throw e;
  }

  const whereActive = incluirInativos ? '' : 'AND is_active = true';

  const sql = `
    SELECT id, categoria_id, nome, is_active, created_at, updated_at
      FROM ${TB_CAIXA_SUBCATEGORIAS}
     WHERE categoria_id = $1
       ${whereActive}
     ORDER BY nome ASC
  `;
  const { rows } = await pool.query(sql, [_categoriaId]);
  return rows;
}

export async function obterSubcategoriaPorId(id) {
  const _id = asInt(id);
  if (!_id) return null;

  const sql = `
    SELECT id, categoria_id, nome, is_active, created_at, updated_at
      FROM ${TB_CAIXA_SUBCATEGORIAS}
     WHERE id = $1
     LIMIT 1
  `;
  const { rows } = await pool.query(sql, [_id]);
  return rows[0] ?? null;
}
