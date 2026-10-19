// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsImagensCreate.repository.js — addImage                     ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB } from './productsImagens.constants.js';
import { normalizeNullableString, normalizeRequiredString, normalizePositiveInt, normalizeBarcodeId } from './productsImagens.sanitizers.js';
import { resolveProductCode, getByIdWithClient } from './productsImagensQuery.repository.js';
import { withTransaction, assertBarcodeBelongsToProduct, clearPrimaryForUnit, refreshUnit } from './productsImagensUnit.repository.js';

/* =========================================================================
   Insert
   ========================================================================= */

export async function addImage({
  product_code = null,
  product_id = null,
  barcode_id = null,
  image_url,
  image_path = null,
  image_alt = null,
  is_primary = false,
  position = null,
  is_active = true
}) {
  return withTransaction('addImage', async (client) => {
    const productCode =
      normalizeNullableString(product_code) ||
      (await resolveProductCode(product_id, client));

    if (!productCode) throw new Error('product_code (ou product_id) inválido para inserção.');

    const imageUrl = normalizeRequiredString(image_url);
    if (!imageUrl) throw new Error('image_url é obrigatório para inserção.');

    const barcodeId = normalizeBarcodeId(barcode_id);
    const isPrimary = Boolean(is_primary);

    if (barcodeId !== null) await assertBarcodeBelongsToProduct(client, barcodeId, productCode);

    if (isPrimary) await clearPrimaryForUnit(client, productCode, barcodeId);

    // Sem posição informada → vai para o final da unidade.
    const { rows: [{ next_pos: nextPos }] } = await client.query(
      `
      SELECT COALESCE(MAX(position), 0) + 1 AS next_pos
        FROM ${TB}
       WHERE product_code = $1
         AND barcode_id IS NOT DISTINCT FROM $2;
      `,
      [productCode, barcodeId]
    );

    const { rows: [created] } = await client.query(
      `
      INSERT INTO ${TB} (
        product_code, barcode_id, image_url, image_path, image_alt,
        is_primary, position, is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING product_image_id;
      `,
      [
        productCode,
        barcodeId,
        imageUrl,
        normalizeNullableString(image_path),
        normalizeNullableString(image_alt),
        isPrimary,
        normalizePositiveInt(position, nextPos),
        Boolean(is_active)
      ]
    );

    await refreshUnit(client, productCode, barcodeId);
    return getByIdWithClient(client, created.product_image_id);
  });
}
