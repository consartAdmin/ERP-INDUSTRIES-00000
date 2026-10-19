// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsGradesUpsert.repository.js — createUpsert                  ║
// ║ Tabela: public."productsGrades" (ON CONFLICT product_id,grade_id)  ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, nowSql } from './productsGrades.constants.js';
import { toNumOrNull, toStr } from './productsGrades.sanitizers.js';
import { ensureTable } from './productsGradesSchema.repository.js';

/* ──────────────────────────────────────────────────────────────
   UPSERT
────────────────────────────────────────────────────────────── */
export async function createUpsert(input = {}) {
  await ensureTable();

  const product_id = toStr(input.product_id);
  const grade_id = toNumOrNull(input.grade_id);

  if (!product_id) {
    throw new Error('product_id é obrigatório.');
  }

  if (!grade_id) {
    throw new Error('grade_id é obrigatório.');
  }

  const stock = toNumOrNull(input.stock) ?? 0;

  const isActive =
    typeof input.is_active === 'string'
      ? ['true', '1', 't', 'yes', 'y']
        .includes(input.is_active.toLowerCase())
      : (input.is_active ?? true);

  const sql = `
    INSERT INTO ${TB}
    (
      product_id,
      grade_id,
      stock,
      is_active
    )
    VALUES ($1, $2, $3, $4)

    ON CONFLICT (product_id, grade_id)
    DO UPDATE
      SET stock = EXCLUDED.stock,
          is_active = EXCLUDED.is_active,
          updated_at = ${nowSql}

    RETURNING *
  `;

  const { rows } = await pool.query(
    sql,
    [product_id, grade_id, stock, isActive]
  );

  return rows[0];
}
