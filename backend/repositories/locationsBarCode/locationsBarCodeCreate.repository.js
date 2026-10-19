// ╔══════════════════════════════════════════════════════════════════════╗
// ║ locationsBarCodeCreate.repository.js — create / generateBins       ║
// ║ Table: public."locationsBarCode"                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { TABLES } from './locationsBarCode.constants.js';
import { normalizeBarcode } from './locationsBarCode.sanitizers.js';

export async function create(pgPool, payload) {
  const barcode = normalizeBarcode(payload.barcode);

  if (!barcode) {
    throw new Error('barcode is required');
  }

  const sql = `
    INSERT INTO ${TABLES.BARCODES} (
      local_id,
      corridor_id,
      shelf_id,
      bin_id,
      position_id,
      barcode,
      barcode_type,
      active
    )
    VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 'CODE128'), COALESCE($8, TRUE))
    RETURNING *;
  `;

  const params = [
    payload.local_id || null,
    payload.corridor_id || null,
    payload.shelf_id || null,
    payload.bin_id || null,
    payload.position_id || null,
    barcode,
    payload.barcode_type || 'CODE128',
    payload.active ?? true,
  ];

  const { rows } = await pgPool.query(sql, params);
  return rows[0];
}

export async function generateBins(pgPool) {
  const sql = `
    INSERT INTO ${TABLES.BARCODES} (
      local_id,
      corridor_id,
      shelf_id,
      bin_id,
      barcode,
      barcode_type,
      active
    )
    SELECT
      ll.id,
      lc.id,
      ls.id,
      lb.id,
      'LOC-BIN-' || LPAD(lb.id::text, 6, '0'),
      'CODE128',
      TRUE
    FROM ${TABLES.LOCALS} ll
    INNER JOIN ${TABLES.CORRIDORS} lc ON lc.local_id = ll.id
    INNER JOIN ${TABLES.SHELVES} ls ON ls.corridor_id = lc.id
    INNER JOIN ${TABLES.BINS} lb ON lb.shelf_id = ls.id
    ON CONFLICT (barcode) DO NOTHING
    RETURNING *;
  `;

  const { rows } = await pgPool.query(sql);
  return rows;
}
