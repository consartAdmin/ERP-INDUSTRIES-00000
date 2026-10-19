// ╔══════════════════════════════════════════════════════════════════════╗
// ║ locationsBarCodeQuery.repository.js — list / getById / getByBarcode║
// ║ Table: public."locationsBarCode" (+ joins de endereçamento)        ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { TABLES } from './locationsBarCode.constants.js';
import { normalizeBarcode } from './locationsBarCode.sanitizers.js';

export async function list(pgPool, { q = '', activeOnly = false, limit = 500, offset = 0 } = {}) {
  const params = [];
  const where = [];
  let idx = 1;

  if (q) {
    params.push(`%${String(q).toLowerCase()}%`);
    where.push(`
      (
        LOWER(COALESCE(lbc.barcode, '')) LIKE $${idx}
        OR LOWER(COALESCE(ll.name, '')) LIKE $${idx}
        OR LOWER(COALESCE(lc.name, '')) LIKE $${idx}
        OR LOWER(COALESCE(ls.name, '')) LIKE $${idx}
        OR LOWER(COALESCE(lb.name, '')) LIKE $${idx}
        OR LOWER(COALESCE(lp.name, '')) LIKE $${idx}
      )
    `);
    idx++;
  }

  if (activeOnly) {
    where.push(`lbc.active = TRUE`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  params.push(Math.max(1, Math.min(Number(limit) || 500, 5000)));
  const limitParam = idx++;

  params.push(Math.max(0, Number(offset) || 0));
  const offsetParam = idx++;

  const sql = `
    SELECT
      lbc.id,
      lbc.local_id,
      lbc.corridor_id,
      lbc.shelf_id,
      lbc.bin_id,
      lbc.position_id,
      lbc.barcode,
      lbc.barcode_type,
      lbc.active,
      lbc.created_at,
      lbc.updated_at,

      ll.name AS local,
      lc.name AS corredor,
      ls.name AS prateleira,
      lb.name AS bandeja,
      lp.name AS position,

      CONCAT_WS(' / ', ll.name, lc.name, ls.name, lb.name, lp.name) AS label

    FROM ${TABLES.BARCODES} lbc

    LEFT JOIN ${TABLES.LOCALS} ll
      ON ll.id = lbc.local_id

    LEFT JOIN ${TABLES.CORRIDORS} lc
      ON lc.id = lbc.corridor_id

    LEFT JOIN ${TABLES.SHELVES} ls
      ON ls.id = lbc.shelf_id

    LEFT JOIN ${TABLES.BINS} lb
      ON lb.id = lbc.bin_id

    LEFT JOIN ${TABLES.POSITIONS} lp
      ON lp.id = lbc.position_id

    ${whereSql}

    ORDER BY lbc.id DESC

    LIMIT $${limitParam}
    OFFSET $${offsetParam};
  `;

  const { rows } = await pgPool.query(sql, params);
  return rows;
}

export async function getById(pgPool, id) {
  const sql = `
    SELECT
      lbc.*,
      ll.name AS local,
      lc.name AS corredor,
      ls.name AS prateleira,
      lb.name AS bandeja,
      lp.name AS position,
      CONCAT_WS(' / ', ll.name, lc.name, ls.name, lb.name, lp.name) AS label
    FROM ${TABLES.BARCODES} lbc
    LEFT JOIN ${TABLES.LOCALS} ll ON ll.id = lbc.local_id
    LEFT JOIN ${TABLES.CORRIDORS} lc ON lc.id = lbc.corridor_id
    LEFT JOIN ${TABLES.SHELVES} ls ON ls.id = lbc.shelf_id
    LEFT JOIN ${TABLES.BINS} lb ON lb.id = lbc.bin_id
    LEFT JOIN ${TABLES.POSITIONS} lp ON lp.id = lbc.position_id
    WHERE lbc.id = $1
    LIMIT 1;
  `;

  const { rows } = await pgPool.query(sql, [id]);
  return rows[0] || null;
}

export async function getByBarcode(pgPool, barcode) {
  const sql = `
    SELECT
      lbc.*,
      ll.name AS local,
      lc.name AS corredor,
      ls.name AS prateleira,
      lb.name AS bandeja,
      lp.name AS position,
      CONCAT_WS(' / ', ll.name, lc.name, ls.name, lb.name, lp.name) AS label
    FROM ${TABLES.BARCODES} lbc
    LEFT JOIN ${TABLES.LOCALS} ll ON ll.id = lbc.local_id
    LEFT JOIN ${TABLES.CORRIDORS} lc ON lc.id = lbc.corridor_id
    LEFT JOIN ${TABLES.SHELVES} ls ON ls.id = lbc.shelf_id
    LEFT JOIN ${TABLES.BINS} lb ON lb.id = lbc.bin_id
    LEFT JOIN ${TABLES.POSITIONS} lp ON lp.id = lbc.position_id
    WHERE lbc.barcode = $1
      AND lbc.active = TRUE
    LIMIT 1;
  `;

  const { rows } = await pgPool.query(sql, [normalizeBarcode(barcode)]);
  return rows[0] || null;
}
