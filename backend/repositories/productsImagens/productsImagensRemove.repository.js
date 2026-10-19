// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsImagensRemove.repository.js — softDeleteImage / hardDeleteImage ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB } from './productsImagens.constants.js';
import { getByIdWithClient } from './productsImagensQuery.repository.js';
import { withTransaction, refreshUnit } from './productsImagensUnit.repository.js';

/* =========================================================================
   Delete
   ========================================================================= */

export async function softDeleteImage(productImageId) {
  return withTransaction('softDeleteImage', async (client) => {
    const current = await getByIdWithClient(client, productImageId);
    if (!current) return null;

    await client.query(
      `
      UPDATE ${TB}
         SET is_active = FALSE,
             is_primary = FALSE
       WHERE product_image_id = $1;
      `,
      [productImageId]
    );

    const barcodeId = current.barcode_id === null ? null : Number(current.barcode_id);
    await refreshUnit(client, current.product_code, barcodeId);
    return getByIdWithClient(client, productImageId);
  });
}

export async function hardDeleteImage(productImageId) {
  return withTransaction('hardDeleteImage', async (client) => {
    const current = await getByIdWithClient(client, productImageId);
    if (!current) return false;

    const { rowCount } = await client.query(
      `DELETE FROM ${TB} WHERE product_image_id = $1;`,
      [productImageId]
    );

    const barcodeId = current.barcode_id === null ? null : Number(current.barcode_id);
    await refreshUnit(client, current.product_code, barcodeId);
    return rowCount > 0;
  });
}
