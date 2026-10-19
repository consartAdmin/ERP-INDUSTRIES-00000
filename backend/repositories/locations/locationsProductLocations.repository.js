// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ locationsProductLocations.repository.js — produto → localização          ║
// ║ Tabela: public."localizationProducts" (+ getLocationByBarcode)           ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

import { TABLES } from './locations.constants.js';
import { buildUpdateSet } from './locations.utils.js';

/* ------------------------------------------------------------------------- */
/* 6) localizationProducts — product → location                              */
/* ------------------------------------------------------------------------- */

export async function listProductLocations(pgPool, { productCode = null } = {}) {
  const params = [];
  let where = '';

  if (productCode) {
    where = 'WHERE lp.product_code = $1';
    params.push(productCode);
  }

  const text = `
    SELECT
      lp.id,
      lp.product_code,
      p.description AS product_description,  -- 👈 descrição do produto
      lp.local_id,
      lp.corridor_id,
      lp.shelf_id,
      lp.bin_id,
      lp.position_id,
      lp.local,
      lp.corridor,
      lp.shelf,
      lp.bin,
      lp.position,
      lp.notes,
      lp.created_at,
      lp.updated_at
    FROM ${TABLES.LOCALIZATION_PRODUCTS} lp
    LEFT JOIN ${TABLES.PRODUCTS} p
      ON p.product_code = lp.product_code   -- 🔁 ajuste aqui se sua coluna for outra
    ${where}
    ORDER BY lp.created_at DESC;
  `;

  const { rows } = await pgPool.query(text, params);
  return rows;
}

export async function getProductLocationById(pgPool, id) {
  const text = `
    SELECT
      lp.id,
      lp.product_code,
      p.description AS product_description,
      lp.local_id,
      lp.corridor_id,
      lp.shelf_id,
      lp.bin_id,
      lp.position_id,
      lp.local,
      lp.corridor,
      lp.shelf,
      lp.bin,
      lp.position,
      lp.notes,
      lp.created_at,
      lp.updated_at
    FROM ${TABLES.LOCALIZATION_PRODUCTS} lp
    LEFT JOIN ${TABLES.PRODUCTS} p
      ON p.product_code = lp.product_code
    WHERE lp.id = $1;
  `;
  const { rows } = await pgPool.query(text, [id]);
  return rows[0] || null;
}

/**
 * Creates a new product-location row
 */
export async function createProductLocation(
  pgPool,
  {
    product_code,
    local_id = null,
    corridor_id = null,
    shelf_id = null,
    bin_id = null,
    position_id = null,
    local,
    corridor,
    shelf,
    bin = null,
    position = null,
    notes = null,
  }
) {
  const text = `
    INSERT INTO ${TABLES.LOCALIZATION_PRODUCTS} (
      product_code,
      local_id,
      corridor_id,
      shelf_id,
      bin_id,
      position_id,
      local,
      corridor,
      shelf,
      bin,
      position,
      notes
    )
    VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10, $11, $12
    )
    RETURNING
      id,
      product_code,
      local_id,
      corridor_id,
      shelf_id,
      bin_id,
      position_id,
      local,
      corridor,
      shelf,
      bin,
      position,
      notes,
      created_at,
      updated_at;
  `;

  const params = [
    product_code,
    local_id,
    corridor_id,
    shelf_id,
    bin_id,
    position_id,
    local,
    corridor,
    shelf,
    bin,
    position,
    notes,
  ];

  const { rows } = await pgPool.query(text, params);
  return rows[0];
}

/**
 * Updates an existing product-location row
 */
export async function updateProductLocation(pgPool, id, payload) {
  const { setClause, values } = buildUpdateSet(payload, 1);
  if (!setClause) {
    throw new Error('[locationsApi] updateProductLocation: empty payload');
  }

  const text = `
    UPDATE ${TABLES.LOCALIZATION_PRODUCTS}
    ${setClause}
    WHERE id = $${values.length + 1}
    RETURNING
      id,
      product_code,
      local_id,
      corridor_id,
      shelf_id,
      bin_id,
      position_id,
      local,
      corridor,
      shelf,
      bin,
      position,
      notes,
      created_at,
      updated_at;
  `;
  const { rows } = await pgPool.query(text, [...values, id]);
  return rows[0] || null;
}

export async function deleteProductLocation(pgPool, id) {
  const text = `DELETE FROM ${TABLES.LOCALIZATION_PRODUCTS} WHERE id = $1;`;
  await pgPool.query(text, [id]);
  return { success: true };
}

export async function getLocationByBarcode(pgPool, barcode) {
  const sql = `
    SELECT
      lbc.id AS barcode_id,
      lbc.barcode,
      lbc.barcode_type,
      lbc.active,

      ll.id AS local_id,
      lc.id AS corridor_id,
      ls.id AS shelf_id,
      lb.id AS bin_id,
      lp.id AS position_id,

      ll.name AS local,
      lc.name AS corredor,
      ls.name AS prateleira,
      lb.name AS bandeja,
      lp.name AS position,

      CONCAT_WS(
        ' / ',
        ll.name,
        lc.name,
        ls.name,
        lb.name,
        lp.name
      ) AS label

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

    WHERE lbc.barcode = $1
      AND lbc.active = TRUE

    LIMIT 1;
  `;

  const { rows } = await pgPool.query(sql, [barcode]);
  return rows[0] || null;
}
