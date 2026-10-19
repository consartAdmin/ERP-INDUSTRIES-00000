// ╔════════════════════════════════════════════════════════════════════╗
// ║ gradesCreate.repository.js — create (UPSERT idempotente)           ║
// ║ Tabela: public."grades"                                            ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TFULL, TNAME, nowSql } from './grades.constants.js';
import { normalizePayload } from './grades.sanitizers.js';
import { ensureTable } from './gradesSchema.repository.js';

/* ──────────────────────────────────────────────────────────────
   create() — Inserção idempotente com UPSERT
────────────────────────────────────────────────────────────── */
export async function create(input = {}) {
  await ensureTable();

  const data = normalizePayload(input);
  if (!data.grade) {
    const err = new Error('grade é obrigatório.');
    err.statusCode = 400;
    throw err;
  }

  // Normaliza para evitar variações de case
  data.grade = String(data.grade).trim().toUpperCase();

  const cols = Object.keys(data);
  const vals = Object.values(data);

  if (!cols.length) {
    const err = new Error('Payload vazio.');
    err.statusCode = 400;
    throw err;
  }

  const params = vals.map((_, i) => `$${i + 1}`);

  // Atualiza somente campos != grade; mantém campo antigo se EXCLUDED vier null
  const setUpdates = cols
    .filter((c) => c !== 'grade')
    .map((c) => `${c} = COALESCE(EXCLUDED.${c}, ${TNAME}.${c})`);

  const sql = `
    INSERT INTO ${TFULL} (${cols.join(', ')})
    VALUES (${params.join(', ')})
    ON CONFLICT (grade) DO UPDATE
    SET ${setUpdates.length ? setUpdates.join(', ') + ',' : ''} updated_at = ${nowSql}
    RETURNING *;
  `;

  try {
    const { rows } = await pool.query(sql, vals);
    return rows[0];
  } catch (e) {
    // duplicidade via idx lower(grade)
    if (e?.code === '23505') {
      const err = new Error('Grade já existe (duplicidade).');
      err.statusCode = 409;
      throw err;
    }
    throw e;
  }
}
