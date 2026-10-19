// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsMobileLocations.repository.js — opções / busca de localização ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { normalizeText } from './productsMobile.sanitizers.js';
import { buildLocation } from './productsMobile.mappers.js';

export async function listLocationOptions() {
  const sql = `
    SELECT
      lb.id,
      lb.barcode,
      lb.barcode_type,
      lb.active,

      ll.name AS local,
      lc.name AS corredor,
      ls.name AS prateleira,
      lbin.name AS bandeja,
      lp.name AS position

    FROM public."locationsBarCode" lb

    LEFT JOIN public."locationLocals" ll
      ON ll.id = lb.local_id

    LEFT JOIN public."locationCorridors" lc
      ON lc.id = lb.corridor_id

    LEFT JOIN public."locationShelves" ls
      ON ls.id = lb.shelf_id

    LEFT JOIN public."locationBins" lbin
      ON lbin.id = lb.bin_id

    LEFT JOIN public."locationPositions" lp
      ON lp.id = lb.position_id

    WHERE COALESCE(lb.active, true) = true

    ORDER BY
      ll.name ASC NULLS LAST,
      lc.name ASC NULLS LAST,
      ls.name ASC NULLS LAST,
      lbin.name ASC NULLS LAST,
      lp.name ASC NULLS LAST,
      lb.id ASC;
  `;

  const { rows } = await pool.query(sql);

  return rows.map((row) => ({
    id: row.id,
    location_barcode_id: row.id,
    barcode: row.barcode,
    barcode_type: row.barcode_type || 'CODE128',
    label: buildLocation(row),
    local: row.local || '',
    corredor: row.corredor || '',
    prateleira: row.prateleira || '',
    bandeja: row.bandeja || '',
    position: row.position || '',
  }));
}

export async function getLocationByBarcode(barcode) {
  const code = normalizeText(barcode);

  if (!code) {
    throw new Error('barcode obrigatório.');
  }

  const sql = `
    SELECT
      lb.id,
      lb.barcode,
      lb.barcode_type,
      lb.active,

      ll.name AS local,
      lc.name AS corredor,
      ls.name AS prateleira,
      lbin.name AS bandeja,
      lp.name AS position

    FROM public."locationsBarCode" lb

    LEFT JOIN public."locationLocals" ll
      ON ll.id = lb.local_id

    LEFT JOIN public."locationCorridors" lc
      ON lc.id = lb.corridor_id

    LEFT JOIN public."locationShelves" ls
      ON ls.id = lb.shelf_id

    LEFT JOIN public."locationBins" lbin
      ON lbin.id = lb.bin_id

    LEFT JOIN public."locationPositions" lp
      ON lp.id = lb.position_id

    WHERE lb.barcode = $1
      AND COALESCE(lb.active, true) = true

    LIMIT 1;
  `;

  const { rows } = await pool.query(sql, [code]);
  const row = rows[0];

  if (!row) {
    throw new Error('Localização não encontrada pelo barcode.');
  }

  return {
    id: row.id,
    location_barcode_id: row.id,
    barcode: row.barcode,
    barcode_type: row.barcode_type || 'CODE128',
    label: buildLocation(row),
    local: row.local || '',
    corredor: row.corredor || '',
    prateleira: row.prateleira || '',
    bandeja: row.bandeja || '',
    position: row.position || '',
  };
}
