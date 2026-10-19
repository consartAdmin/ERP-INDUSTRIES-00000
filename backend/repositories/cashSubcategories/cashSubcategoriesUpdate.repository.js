// ╔════════════════════════════════════════════════════════════════════╗
// ║ cashSubcategoriesUpdate.repository.js — atualizar / toggle ativo   ║
// ║ Tabela: "cashSubcategories"                                        ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_CAIXA_SUBCATEGORIAS } from './cashSubcategories.constants.js';
import { asInt, safeStr, asBool } from './cashSubcategories.sanitizers.js';
import { isUniqueViolation } from './cashSubcategories.utils.js';

export async function atualizarSubcategoria(id, { nome, is_active, categoria_id }) {
  const _id = asInt(id);
  if (!_id) {
    const e = new Error('ID inválido.');
    e.statusCode = 400;
    throw e;
  }

  const updates = [];
  const values = [_id];

  if (typeof categoria_id !== 'undefined') {
    const _categoriaId = asInt(categoria_id);
    if (!_categoriaId) {
      const e = new Error('categoria_id inválido.');
      e.statusCode = 400;
      throw e;
    }
    values.push(_categoriaId);
    updates.push(`categoria_id = $${values.length}`);
  }

  if (typeof nome !== 'undefined') {
    const _nome = safeStr(nome, 100);
    if (!_nome) {
      const e = new Error('Nome inválido.');
      e.statusCode = 400;
      throw e;
    }
    values.push(_nome);
    updates.push(`nome = $${values.length}`);
  }

  if (typeof is_active !== 'undefined') {
    values.push(asBool(is_active, true));
    updates.push(`is_active = $${values.length}`);
  }

  if (!updates.length) {
    const e = new Error('Nada para atualizar.');
    e.statusCode = 400;
    throw e;
  }

  const sql = `
    UPDATE ${TB_CAIXA_SUBCATEGORIAS}
       SET ${updates.join(', ')},
           updated_at = now()
     WHERE id = $1
     RETURNING id, categoria_id, nome, is_active, created_at, updated_at
  `;

  try {
    const { rows } = await pool.query(sql, values);
    return rows[0] ?? null;
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

export async function setSubcategoriaAtiva(id, is_active) {
  const _id = asInt(id);
  if (!_id) {
    const e = new Error('ID inválido.');
    e.statusCode = 400;
    throw e;
  }

  const _active = asBool(is_active, true);

  const sql = `
    UPDATE ${TB_CAIXA_SUBCATEGORIAS}
       SET is_active = $2,
           updated_at = now()
     WHERE id = $1
     RETURNING id, categoria_id, nome, is_active, created_at, updated_at
  `;
  const { rows } = await pool.query(sql, [_id, _active]);
  return rows[0] ?? null;
}
