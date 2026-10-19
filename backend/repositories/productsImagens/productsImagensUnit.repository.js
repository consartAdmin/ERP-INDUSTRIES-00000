// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsImagensUnit.repository.js — helpers de negócio (product_code + barcode_id) ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, TB_PRODUCTS } from './productsImagens.constants.js';

/* =========================================================================
   Helpers de negócio (escopo: product_code + barcode_id)
   ========================================================================= */

export async function clearPrimaryForUnit(client, productCode, barcodeId, exceptId = null) {
  await client.query(
    `
    UPDATE ${TB}
       SET is_primary = FALSE
     WHERE product_code = $1
       AND barcode_id IS NOT DISTINCT FROM $2
       AND is_primary = TRUE
       AND ($3::bigint IS NULL OR product_image_id <> $3::bigint);
    `,
    [productCode, barcodeId, exceptId]
  );
}

export async function ensureOnePrimaryIfPossible(client, productCode, barcodeId) {
  const { rows } = await client.query(
    `
    SELECT product_image_id, is_primary
      FROM ${TB}
     WHERE product_code = $1
       AND barcode_id IS NOT DISTINCT FROM $2
       AND is_active = TRUE
     ORDER BY is_primary DESC, position ASC, product_image_id ASC;
    `,
    [productCode, barcodeId]
  );

  if (!rows.length || rows[0].is_primary) return;

  await client.query(
    `UPDATE ${TB} SET is_primary = TRUE WHERE product_image_id = $1;`,
    [rows[0].product_image_id]
  );
}

export async function normalizePositions(client, productCode, barcodeId) {
  await client.query(
    `
    WITH ordered AS (
      SELECT product_image_id,
             ROW_NUMBER() OVER (ORDER BY position ASC, product_image_id ASC) AS new_pos
        FROM ${TB}
       WHERE product_code = $1
         AND barcode_id IS NOT DISTINCT FROM $2
    )
    UPDATE ${TB} t
       SET position = o.new_pos
      FROM ordered o
     WHERE t.product_image_id = o.product_image_id
       AND t.position <> o.new_pos;
    `,
    [productCode, barcodeId]
  );
}

// products.product_imagem_id aponta apenas para a imagem geral principal.
export async function syncProductPrimaryImage(client, productCode) {
  await client.query(
    `
    UPDATE ${TB_PRODUCTS}
       SET product_imagem_id = (
             SELECT product_image_id
               FROM ${TB}
              WHERE product_code = $1
                AND barcode_id IS NULL
                AND is_active = TRUE
                AND is_primary = TRUE
              ORDER BY position ASC, product_image_id ASC
              LIMIT 1
           ),
           updated_at = NOW()
     WHERE product_code = $1;
    `,
    [productCode]
  );
}

export async function assertBarcodeBelongsToProduct(client, barcodeId, productCode) {
  const { rows } = await client.query(
    `
    SELECT 1
      FROM public."productsBarCode"
     WHERE barcode_id = $1
       AND product_code = $2
       AND is_active = TRUE
     LIMIT 1;
    `,
    [barcodeId, productCode]
  );

  if (!rows.length) {
    const err = new Error('A unidade (barcode_id) não pertence a este produto.');
    err.status = 400;
    throw err;
  }
}

export async function refreshUnit(client, productCode, barcodeId) {
  await normalizePositions(client, productCode, barcodeId);
  await ensureOnePrimaryIfPossible(client, productCode, barcodeId);
  if (barcodeId === null) await syncProductPrimaryImage(client, productCode);
}

export async function withTransaction(label, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* noop */ }
    console.error(`[productsImagensApi.${label}] erro:`, error);
    throw error;
  } finally {
    client.release();
  }
}
