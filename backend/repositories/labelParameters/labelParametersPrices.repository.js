// ╔══════════════════════════════════════════════════════════════════════╗
// ║ labelParametersPrices.repository.js — tabelas de preço p/ etiquetas ║
// ║ Tabelas: public.prices / public."productsPrices"                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { PRICES_TABLE, PRODUCTS_PRICES_TABLE } from './labelParameters.constants.js';
import { withClient } from './labelParameters.utils.js';

/* ======================================================================
   PUBLIC API — prices / productsPrices (for labelsController)
   ====================================================================== */

/**
 * List available price tables
 */
export async function listPriceTables() {
  return withClient(async (client) => {
    const result = await client.query(`
      SELECT
        price_id,
        name,
        description,
        active
      FROM ${PRICES_TABLE}
      ORDER BY price_id ASC;
    `);

    return result.rows;
  });
}

/**
 * Get product price for label generation
 *
 * @param {string|number} productCodeOrBarcode
 * @param {number} priceTableId
 * @returns {Promise<number|null>}
 */
export async function getProductPriceForLabel(productCodeOrBarcode, priceTableId) {
  const code = String(productCodeOrBarcode ?? '').trim();
  const priceId = Number(priceTableId);

  if (!code || !Number.isInteger(priceId) || priceId <= 0) {
    console.warn('[labelParametersApi] Invalid productCodeOrBarcode or priceTableId', {
      productCodeOrBarcode,
      priceTableId,
      code,
      priceId,
    });
    return null;
  }

  return withClient(async (client) => {
    const query = `
      SELECT
        pp.sale_price AS price
      FROM public.products p
      LEFT JOIN ${PRODUCTS_PRICES_TABLE} pp
        ON pp.product_id::varchar = p.product_id::varchar
      WHERE
        pp.price_id = $1::INTEGER
        AND (
             p.product_code::varchar = $2::varchar
          OR p.barcode::varchar      = $2::varchar
          OR p.product_id::varchar   = $2::varchar
        )
      ORDER BY pp.updated_at DESC NULLS LAST
      LIMIT 1;
    `;

    const { rows } = await client.query(query, [priceId, code]);

    if (!rows.length) return null;

    const value = rows[0].price;
    return value != null ? Number(value) : null;
  });
}
