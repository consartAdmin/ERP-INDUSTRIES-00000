// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsImagensReorder.repository.js — reorderImages (imagens gerais) ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB } from './productsImagens.constants.js';
import { BASE_SELECT, ORDER_BY } from './productsImagens.sql.js';
import { withTransaction, refreshUnit } from './productsImagensUnit.repository.js';

/* =========================================================================
   Reorder (imagens gerais do produto — barcode_id NULL)
   ========================================================================= */

export async function reorderImages(productCode, orderedIds = []) {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) return [];

  return withTransaction('reorderImages', async (client) => {
    const { rows: validRows } = await client.query(
      `
      SELECT product_image_id
        FROM ${TB}
       WHERE product_code = $1
         AND barcode_id IS NULL
       ORDER BY position ASC, product_image_id ASC;
      `,
      [productCode]
    );

    const validIds = validRows.map((r) => Number(r.product_image_id));
    const validSet = new Set(validIds);
    const filteredIds = [...new Set(
      orderedIds
        .map((id) => Number.parseInt(id, 10))
        .filter((id) => Number.isInteger(id) && validSet.has(id))
    )];

    if (!filteredIds.length) {
      throw new Error('Nenhum ID válido foi informado para reordenação.');
    }

    const finalOrder = [...filteredIds, ...validIds.filter((id) => !filteredIds.includes(id))];

    await client.query(
      `
      UPDATE ${TB} t
         SET position = o.ord
        FROM unnest($1::bigint[]) WITH ORDINALITY AS o(id, ord)
       WHERE t.product_image_id = o.id
         AND t.position <> o.ord;
      `,
      [finalOrder]
    );

    await refreshUnit(client, productCode, null);

    const { rows } = await client.query(
      `
      ${BASE_SELECT}
      WHERE img.product_code = $1
      ${ORDER_BY};
      `,
      [productCode]
    );
    return rows;
  });
}
