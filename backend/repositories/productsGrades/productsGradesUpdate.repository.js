// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsGradesUpdate.repository.js — update (patch stock/ativo)    ║
// ║ Tabela: public."productsGrades"                                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, nowSql } from './productsGrades.constants.js';
import { toNumOrNull } from './productsGrades.sanitizers.js';
import { ensureTable } from './productsGradesSchema.repository.js';

/* ──────────────────────────────────────────────────────────────
   UPDATE
────────────────────────────────────────────────────────────── */
export async function update(id, patch = {}) {
  await ensureTable();

  const sets = [];
  const vals = [];

  if ('stock' in patch) {
    vals.push(toNumOrNull(patch.stock) ?? 0);
    sets.push(`stock = $${vals.length}`);
  }

  if ('is_active' in patch) {
    const v = patch.is_active;

    const b =
      typeof v === 'string'
        ? ['true', '1', 't', 'yes', 'y']
          .includes(v.toLowerCase())
        : !!v;

    vals.push(b);
    sets.push(`is_active = $${vals.length}`);
  }

  if (!sets.length) {
    const { rows } = await pool.query(
      `SELECT * FROM ${TB} WHERE product_grade_id = $1`,
      [Number(id)]
    );

    return rows[0] || null;
  }

  const sql = `
    UPDATE ${TB}
       SET ${sets.join(', ')},
           updated_at = ${nowSql}
     WHERE product_grade_id = $${vals.length + 1}
     RETURNING *
  `;

  const { rows } = await pool.query(
    sql,
    [...vals, Number(id)]
  );

  return rows[0] || null;
}
