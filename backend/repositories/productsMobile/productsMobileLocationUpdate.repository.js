// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsMobileLocationUpdate.repository.js — updateProductLocation ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { normalizeText } from './productsMobile.sanitizers.js';

export async function updateProductLocation(productCode, locationBarcodeId) {
  const code = normalizeText(productCode);

  if (!code) {
    throw new Error('product_code obrigatório.');
  }

  if (!locationBarcodeId) {
    throw new Error('location_barcode_id obrigatório.');
  }

  const locResult = await pool.query(
    `
    SELECT
      lb.id AS location_barcode_id,
      lb.barcode,

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

    WHERE lb.id = $1
      AND COALESCE(lb.active, true) = true

    LIMIT 1;
    `,
    [locationBarcodeId]
  );

  const location = locResult.rows[0];

  if (!location) {
    throw new Error('Localização não encontrada.');
  }

  const currentResult = await pool.query(
    `
    SELECT id
    FROM public."productsLocations"
    WHERE product_code = $1
      AND COALESCE(is_active, true) = true
    ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    LIMIT 1;
    `,
    [code]
  );

  const current = currentResult.rows[0];

  const observacao = [
    location.local,
    location.corredor,
    location.prateleira,
    location.bandeja,
    location.position,
    location.barcode,
  ]
    .map(normalizeText)
    .filter(Boolean)
    .join(' / ');

  if (current?.id) {
    const { rows } = await pool.query(
      `
      UPDATE public."productsLocations"
      SET
        corredor = $2,
        prateleira = $3,
        bandeja = $4,
        box = $5,
        observacao = $6,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *;
      `,
      [
        current.id,
        location.corredor,
        location.prateleira,
        location.bandeja,
        location.position,
        observacao,
      ]
    );

    return rows[0];
  }

  const { rows } = await pool.query(
    `
    INSERT INTO public."productsLocations" (
      product_code,
      corredor,
      prateleira,
      bandeja,
      box,
      observacao,
      is_active,
      created_at,
      updated_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,true,NOW(),NOW())
    RETURNING *;
    `,
    [
      code,
      location.corredor,
      location.prateleira,
      location.bandeja,
      location.position,
      observacao,
    ]
  );

  return rows[0];
}
