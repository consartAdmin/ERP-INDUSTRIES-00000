// ╔════════════════════════════════════════════════════════════════════╗
// ║ gradesUpdate.repository.js — update parcial (bloqueia renomeio)    ║
// ║ Tabela: public."grades"                                            ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TFULL, nowSql } from './grades.constants.js';
import { clampInt, normalizePayload } from './grades.sanitizers.js';
import { ensureTable } from './gradesSchema.repository.js';
import { getById } from './gradesQuery.repository.js';

/* ──────────────────────────────────────────────────────────────
   update() — Atualização parcial (bloqueia alteração de grade)
────────────────────────────────────────────────────────────── */
export async function update(id, input = {}) {
  await ensureTable();

  const gradeId = clampInt(id, { min: 1, max: 2_000_000_000 });

  const data = normalizePayload(input);

  // Bloqueia renomeio de grade (se quiser permitir, trate separado)
  if ('grade' in data) delete data.grade;

  if (!Object.keys(data).length) return getById(gradeId);

  const sets = [];
  const vals = [];
  Object.entries(data).forEach(([col, val]) => {
    vals.push(val);
    sets.push(`${col} = $${vals.length}`);
  });

  const sql = `
    UPDATE ${TFULL}
    SET ${sets.join(', ')}, updated_at = ${nowSql}
    WHERE grade_id = $${vals.length + 1}
    RETURNING *;
  `;

  try {
    const { rows } = await pool.query(sql, [...vals, gradeId]);
    return rows[0] || null;
  } catch (e) {
    if (e?.code === '23505') {
      const err = new Error('Conflito de duplicidade ao atualizar.');
      err.statusCode = 409;
      throw err;
    }
    throw e;
  }
}
