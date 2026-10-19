// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsNotesUpdate.repository.js — update / softDelete            ║
// ║ Tabela: public."productsNotes"                                     ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';

export async function update(id, data) {
  const sql = `
    UPDATE public."productsNotes"
    SET
      note_type = COALESCE($2, note_type),
      title = COALESCE($3, title),
      note = COALESCE($4, note),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *;
  `;

  const values = [
    id,
    data.note_type || null,
    data.title || null,
    data.note || null,
  ];

  const { rows } = await pool.query(sql, values);
  return rows[0] || null;
}

export async function softDelete(id) {
  const sql = `
    UPDATE public."productsNotes"
    SET
      is_active = FALSE,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *;
  `;

  const { rows } = await pool.query(sql, [id]);
  return rows[0] || null;
}
