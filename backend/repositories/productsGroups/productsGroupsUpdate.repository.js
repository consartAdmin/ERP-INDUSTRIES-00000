// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsGroupsUpdate.repository.js — update / deactivate (soft)    ║
// ║ Tabela: public."productsGroups"                                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, COLS } from './productsGroups.constants.js';
import { notEmptyStr } from './productsGroups.sanitizers.js';
import { uniqueViolation } from './productsGroups.utils.js';
import { mapRow } from './productsGroups.mappers.js';

// ──────────────────────────────────────────────────────────────────────────────
// Update
// ──────────────────────────────────────────────────────────────────────────────
export async function updateProductsGroup(id, patch = {}) {
  const sets = [];
  const values = [];
  let i = 1;

  if (patch.name !== undefined) {
    if (!notEmptyStr(patch.name)) {
      const e = new Error('O campo "name" não pode ser vazio.');
      e.status = 400;
      throw e;
    }
    if (patch.name.trim().length > 100) {
      const e = new Error('O campo "name" deve ter no máximo 100 caracteres.');
      e.status = 400;
      throw e;
    }
    sets.push(`${COLS.name} = $${i++}`);
    values.push(patch.name.trim());
  }

  if (patch.is_active !== undefined) {
    sets.push(`${COLS.is_active} = $${i++}`);
    values.push(!!patch.is_active);
  }

  if (!sets.length) {
    const e = new Error('Nada para atualizar.');
    e.status = 400;
    throw e;
  }

  const sql = `
    UPDATE public.${TB}
       SET ${sets.join(', ')}, ${COLS.updated_at} = NOW()
     WHERE ${COLS.id} = $${i}
    RETURNING
      ${COLS.id},
      ${COLS.name},
      ${COLS.created_at},
      ${COLS.updated_at},
      ${COLS.is_active};
  `;
  values.push(id);

  try {
    const res = await pool.query(sql, values);
    return mapRow(res.rows[0]);
  } catch (err) {
    if (uniqueViolation(err)) {
      const e = new Error(`Já existe um grupo com o nome "${patch.name?.trim()}".`);
      e.status = 409;
      throw e;
    }
    throw err;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Deactivate (soft-delete)
// ──────────────────────────────────────────────────────────────────────────────
export async function deactivateProductsGroup(id) {
  const res = await pool.query(
    `
      UPDATE public.${TB}
         SET ${COLS.is_active} = FALSE,
             ${COLS.updated_at} = NOW()
       WHERE ${COLS.id} = $1
      RETURNING
        ${COLS.id},
        ${COLS.name},
        ${COLS.created_at},
        ${COLS.updated_at},
        ${COLS.is_active};
    `,
    [id],
  );
  return mapRow(res.rows[0]);
}
