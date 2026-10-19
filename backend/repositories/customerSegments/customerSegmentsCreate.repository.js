// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerSegmentsCreate.repository.js — create()                    ║
// ║ Gera segment_code = SEG-000001 (mesma transação do INSERT)         ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { tbl, nowSql } from './customerSegments.constants.js';
import { normalizePayload } from './customerSegments.sanitizers.js';
import { ensureTable } from './customerSegmentsSchema.repository.js';

/* ──────────────────────────────────────────────────────────────
   create() — gera segment_code = SEG-000001
────────────────────────────────────────────────────────────── */
export async function create(input = {}) {
  await ensureTable();

  const data = normalizePayload(input);

  if (!data.segment_name) {
    throw new Error('segment_name is required.');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const insertRes = await client.query(
      `
        INSERT INTO ${tbl()}
          (segment_code, segment_name, description, is_active)
        VALUES
          (NULL, $1, $2, COALESCE($3, TRUE))
        RETURNING *;
      `,
      [
        data.segment_name,
        data.description ?? null,
        data.is_active
      ]
    );

    const base = insertRes.rows[0];
    const code = `SEG-${String(base.segment_id).padStart(6, '0')}`;

    const updateRes = await client.query(
      `
        UPDATE ${tbl()}
        SET segment_code = $1, updated_at = ${nowSql}
        WHERE segment_id = $2
        RETURNING *;
      `,
      [code, base.segment_id]
    );

    await client.query('COMMIT');
    return updateRes.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ create(customerSegments) error:', err.message);
    throw err;
  } finally {
    client.release();
  }
}
