// ╔════════════════════════════════════════════════════════════════════╗
// ║ cashCategoriesUpdate.repository.js — atualizar / toggle ativo      ║
// ║ Tabela: "cashCategories"                                           ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_CAIXA_CATEGORIAS } from './cashCategories.constants.js';
import { asInt, safeStr, asBool } from './cashCategories.sanitizers.js';
import { isUniqueViolation } from './cashCategories.utils.js';

export async function atualizarCategoria(id, { nome, is_active }) {
  const _id = asInt(id);
  const _nome = safeStr(nome, 100);
  const _hasActive = typeof is_active !== 'undefined';

  if (!_id) {
    const e = new Error('ID inválido.');
    e.statusCode = 400;
    throw e;
  }
  if (!_nome) {
    const e = new Error('Nome da categoria é obrigatório.');
    e.statusCode = 400;
    throw e;
  }

  const params = [_id, _nome];
  let setActiveSql = '';
  if (_hasActive) {
    params.push(asBool(is_active, true));
    setActiveSql = `, is_active = $${params.length}`;
  }

  const sql = `
    UPDATE ${TB_CAIXA_CATEGORIAS}
       SET nome = $2
           ${setActiveSql}
           , updated_at = now()
     WHERE id = $1
     RETURNING id, nome, is_active, created_at, updated_at
  `;

  try {
    const { rows } = await pool.query(sql, params);
    return rows[0] ?? null;
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

export async function setCategoriaAtiva(id, is_active) {
  const _id = asInt(id);
  if (!_id) {
    const e = new Error('ID inválido.');
    e.statusCode = 400;
    throw e;
  }

  const _active = asBool(is_active, true);

  const sql = `
    UPDATE ${TB_CAIXA_CATEGORIAS}
       SET is_active = $2,
           updated_at = now()
     WHERE id = $1
     RETURNING id, nome, is_active, created_at, updated_at
  `;
  const { rows } = await pool.query(sql, [_id, _active]);
  return rows[0] ?? null;
}
