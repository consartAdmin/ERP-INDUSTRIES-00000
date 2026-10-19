// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsNotesQuery.repository.js — listByProduct / getById         ║
// ║ Tabela: public."productsNotes"                                     ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { normalizeLimit } from './productsNotes.sanitizers.js';

export async function listByProduct(productCode, options = {}) {
  const limit = normalizeLimit(options.limit);

  const sql = `
    SELECT
      id,
      product_code,
      note_type,
      title,
      note,
      created_by,
      created_at,
      updated_at,
      is_active
    FROM public."productsNotes"
    WHERE product_code = $1
      AND is_active = TRUE
    ORDER BY created_at DESC, id DESC
    LIMIT $2;
  `;

  const { rows } = await pool.query(sql, [productCode, limit]);
  return rows;
}

export async function getById(id) {
  const sql = `
    SELECT
      id,
      product_code,
      note_type,
      title,
      note,
      created_by,
      created_at,
      updated_at,
      is_active
    FROM public."productsNotes"
    WHERE id = $1;
  `;

  const { rows } = await pool.query(sql, [id]);
  return rows[0] || null;
}
