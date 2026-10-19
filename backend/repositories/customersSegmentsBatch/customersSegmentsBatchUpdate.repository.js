// ╔════════════════════════════════════════════════════════════════════╗
// ║ customersSegmentsBatchUpdate.repository.js — batchApply / unlinkOne║
// ║ POST batch-apply / POST unlink — Tabela: public."customers"        ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_CUSTOMERS, TB_SEGMENTS } from './customersSegmentsBatch.constants.js';

/* ============================================================================
   BATCH APPLY
============================================================================ */

export async function batchApply({ customerIds = [], segment_id }) {

  if (!Array.isArray(customerIds) || !customerIds.length) {
    throw new Error('customerIds is required.');
  }

  if (!Number.isFinite(Number(segment_id))) {
    throw new Error('segment_id is required.');
  }

  const ids = customerIds.map(Number).filter(n => Number.isFinite(n));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const segCheck = await client.query(
      `SELECT segment_id FROM ${TB_SEGMENTS} WHERE segment_id = $1 LIMIT 1;`,
      [Number(segment_id)]
    );

    if (!segCheck.rows.length) {
      throw new Error('Segmento não encontrado.');
    }

    const updateRes = await client.query(
      `
        UPDATE ${TB_CUSTOMERS}
        SET segment_id = $1
        WHERE customer_id = ANY($2::bigint[]);
      `,
      [Number(segment_id), ids]
    );

    await client.query('COMMIT');

    return {
      ok: true,
      updated: updateRes.rowCount,
      attempted: ids.length,
      segment_id: Number(segment_id)
    };

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* ============================================================================
   UNLINK ONE
============================================================================ */

export async function unlinkOne({ customer_id }) {

  if (!Number.isFinite(Number(customer_id))) {
    throw new Error('customer_id is required.');
  }

  const { rowCount } = await pool.query(
    `
      UPDATE ${TB_CUSTOMERS}
      SET segment_id = NULL
      WHERE customer_id = $1;
    `,
    [Number(customer_id)]
  );

  return {
    ok: true,
    customer_id: Number(customer_id),
    updated: rowCount
  };
}
