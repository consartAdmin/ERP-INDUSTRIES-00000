// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsSubgroupsUpdate.repository.js — atualizar / desativar      ║
// ║ Tabela: public."productsSubgroups"                                 ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, COLS } from './productsSubgroups.constants.js';
import { notEmptyStr } from './productsSubgroups.sanitizers.js';
import { mapRow } from './productsSubgroups.mappers.js';

// ──────────────────────────────────────────────────────────────────────────────
/** Atualizar */
// ──────────────────────────────────────────────────────────────────────────────
export async function updateProductsSubgroup(id, patch = {}) {
  const sets = [];
  const values = [];
  let i = 1;

  if (patch.name !== undefined) {
    if (!notEmptyStr(patch.name)) {
      const e = new Error('O campo "name" não pode ser vazio.'); e.status = 400; throw e;
    }
    sets.push(`${COLS.name} = $${i++}`); values.push(patch.name.trim());
  }

  if (patch.group_id !== undefined) {
    sets.push(`${COLS.group_id} = $${i++}`); values.push(patch.group_id);
  }

  if (patch.is_active !== undefined) {
    sets.push(`${COLS.is_active} = $${i++}`); values.push(!!patch.is_active);
  }

  if (!sets.length) { const e = new Error('Nada para atualizar.'); e.status = 400; throw e; }

  const sql = `
    UPDATE public.${TB}
       SET ${sets.join(', ')}, ${COLS.updated_at} = NOW()
     WHERE ${COLS.id} = $${i}
    RETURNING ${COLS.id}, ${COLS.name}, ${COLS.group_id}, ${COLS.created_at}, ${COLS.updated_at}, ${COLS.is_active};
  `;
  values.push(id);

  const res = await pool.query(sql, values);
  return mapRow(res.rows[0]);
}

// ──────────────────────────────────────────────────────────────────────────────
/** Desativar */
// ──────────────────────────────────────────────────────────────────────────────
export async function deactivateProductsSubgroup(id) {
  const res = await pool.query(
    `UPDATE public.${TB}
        SET ${COLS.is_active} = FALSE, ${COLS.updated_at} = NOW()
      WHERE ${COLS.id} = $1
    RETURNING ${COLS.id}, ${COLS.name}, ${COLS.group_id}, ${COLS.created_at}, ${COLS.updated_at}, ${COLS.is_active};`,
    [id]
  );
  return mapRow(res.rows[0]);
}
