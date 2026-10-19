// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsNotesCreate.repository.js — create                         ║
// ║ Tabela: public."productsNotes"                                     ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';

export async function create(data) {
  const sql = `
    INSERT INTO public."productsNotes"
    (
      product_code,
      note_type,
      title,
      note,
      created_by
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *;
  `;

  const values = [
    data.product_code,
    data.note_type || 'GENERAL',
    data.title || null,
    data.note,
    data.created_by || null,
  ];

  const { rows } = await pool.query(sql, values);
  return rows[0];
}
