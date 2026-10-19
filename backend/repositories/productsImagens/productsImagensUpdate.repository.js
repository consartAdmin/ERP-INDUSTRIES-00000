// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsImagensUpdate.repository.js — updateImage / setPrimaryImage ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB } from './productsImagens.constants.js';
import { normalizeNullableString, normalizeRequiredString, normalizePositiveInt, normalizeBarcodeId } from './productsImagens.sanitizers.js';
import { getByIdWithClient } from './productsImagensQuery.repository.js';
import { withTransaction, assertBarcodeBelongsToProduct, clearPrimaryForUnit, refreshUnit } from './productsImagensUnit.repository.js';

/* =========================================================================
   Update
   ========================================================================= */

export async function updateImage(productImageId, fields = {}) {
  return withTransaction('updateImage', async (client) => {
    const current = await getByIdWithClient(client, productImageId);
    if (!current) return null;

    const has = (key) => Object.prototype.hasOwnProperty.call(fields, key);

    const next = {
      image_url: has('image_url') ? normalizeRequiredString(fields.image_url) : current.image_url,
      image_path: has('image_path') ? normalizeNullableString(fields.image_path) : current.image_path,
      image_alt: has('image_alt') ? normalizeNullableString(fields.image_alt) : current.image_alt,
      is_primary: has('is_primary') ? Boolean(fields.is_primary) : current.is_primary,
      position: has('position') ? normalizePositiveInt(fields.position, 1) : normalizePositiveInt(current.position, 1),
      is_active: has('is_active') ? Boolean(fields.is_active) : current.is_active
    };

    if (!next.image_url) throw new Error('image_url não pode ficar vazio.');
    if (!next.is_active) next.is_primary = false;

    const currentBarcodeId = current.barcode_id === null ? null : Number(current.barcode_id);
    const barcodeId = has('barcode_id') ? normalizeBarcodeId(fields.barcode_id) : currentBarcodeId;
    const movedUnit = barcodeId !== currentBarcodeId;

    if (movedUnit) {
      if (barcodeId !== null) await assertBarcodeBelongsToProduct(client, barcodeId, current.product_code);

      // Ao trocar de unidade vai para o final e só vira principal se pedido
      // (ou se a unidade de destino não tiver principal — ver refreshUnit).
      if (!has('is_primary')) next.is_primary = false;
      if (!has('position')) {
        const { rows: [{ next_pos: nextPos }] } = await client.query(
          `
          SELECT COALESCE(MAX(position), 0) + 1 AS next_pos
            FROM ${TB}
           WHERE product_code = $1
             AND barcode_id IS NOT DISTINCT FROM $2;
          `,
          [current.product_code, barcodeId]
        );
        next.position = nextPos;
      }
    }

    if (next.is_primary) {
      await clearPrimaryForUnit(client, current.product_code, barcodeId, productImageId);
    }

    await client.query(
      `
      UPDATE ${TB}
         SET image_url = $1,
             image_path = $2,
             image_alt = $3,
             is_primary = $4,
             position = $5,
             is_active = $6,
             barcode_id = $7
       WHERE product_image_id = $8;
      `,
      [
        next.image_url,
        next.image_path,
        next.image_alt,
        next.is_primary,
        next.position,
        next.is_active,
        barcodeId,
        productImageId
      ]
    );

    await refreshUnit(client, current.product_code, barcodeId);
    if (movedUnit) await refreshUnit(client, current.product_code, currentBarcodeId);
    return getByIdWithClient(client, productImageId);
  });
}

/* =========================================================================
   Primary image
   ========================================================================= */

export async function setPrimaryImage(productImageId) {
  return withTransaction('setPrimaryImage', async (client) => {
    const target = await getByIdWithClient(client, productImageId);
    if (!target) return null;
    if (!target.is_active) throw new Error('Não é possível definir uma imagem inativa como principal.');

    const barcodeId = target.barcode_id === null ? null : Number(target.barcode_id);

    await clearPrimaryForUnit(client, target.product_code, barcodeId);
    await client.query(
      `UPDATE ${TB} SET is_primary = TRUE WHERE product_image_id = $1;`,
      [productImageId]
    );

    await refreshUnit(client, target.product_code, barcodeId);
    return getByIdWithClient(client, productImageId);
  });
}
