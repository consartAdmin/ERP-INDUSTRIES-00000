// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerSubSegmentsCreate.repository.js — create()                 ║
// ║ Gera subsegment_code = SUB-000001 (mesma transação do INSERT)      ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { tbl, nowSql } from './customerSubSegments.constants.js';
import { normalizePayload } from './customerSubSegments.sanitizers.js';
import { ensureTable } from './customerSubSegmentsSchema.repository.js';

/* ──────────────────────────────────────────────────────────────
   create() — gera subsegment_code = SUB-{id}
────────────────────────────────────────────────────────────── */
export async function create(input = {}) {
  await ensureTable();
  const data = normalizePayload(input);

  if (!data.segment_id) {
    throw new Error('segment_id is required.');
  }
  if (!data.subsegment_name) {
    throw new Error('subsegment_name is required.');
  }

  const cols = Object.keys(data);
  const vals = Object.values(data);
  const params = vals.map((_, i) => `$${i + 1}`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const insertSql = `
      INSERT INTO ${tbl()} (${cols.join(', ')})
      VALUES (${params.join(', ')})
      RETURNING *;
    `;
    const insertRes = await client.query(insertSql, vals);
    const base = insertRes.rows[0];

    const code = `SUB-${String(base.subsegment_id).padStart(6, '0')}`;

    const updateRes = await client.query(
      `
        UPDATE ${tbl()}
        SET subsegment_code = $1, updated_at = ${nowSql}
        WHERE subsegment_id = $2
        RETURNING *;
      `,
      [code, base.subsegment_id]
    );

    await client.query('COMMIT');
    return updateRes.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ create(customerSubSegments) error:', err.message);
    throw err;
  } finally {
    client.release();
  }
}
