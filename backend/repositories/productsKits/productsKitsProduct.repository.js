// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsKitsProduct.repository.js — produto base do kit / preço    ║
// ╚════════════════════════════════════════════════════════════════════╝

import { toNum } from './productsKits.sanitizers.js';

export async function getProductByCode(client, productCode) {
  const code = String(productCode || '').trim();
  if (!code) return null;

  const result = await client.query(`
    SELECT *
    FROM public.products
    WHERE product_code = $1
    LIMIT 1
  `, [code]);

  return result.rows[0] || null;
}

export async function getFirstItemProductData(client, items = []) {
  const first = items.find((item) => item?.product_sku);
  if (!first) return null;

  return await getProductByCode(client, first.product_sku);
}

export async function syncProductPrice(client, productId, salePrice) {
  const price = toNum(salePrice, 0);

  if (!productId) return;

  try {
    await client.query('SAVEPOINT sp_products_kits_price');

    const tableExists = await client.query(`
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'productsPrices'
      LIMIT 1
    `);

    if (!tableExists.rowCount) {
      await client.query('RELEASE SAVEPOINT sp_products_kits_price');
      return;
    }

    const result = await client.query(`
      SELECT id
      FROM public."productsPrices"
      WHERE product_id = $1
        AND price_id = 1
      LIMIT 1
    `, [productId]);

    if (result.rows.length) {
      await client.query(`
        UPDATE public."productsPrices"
        SET sale_price = $1
        WHERE id = $2
      `, [price, result.rows[0].id]);
    } else {
      await client.query(`
        INSERT INTO public."productsPrices"
          (product_id, price_id, sale_price)
        VALUES
          ($1, 1, $2)
      `, [productId, price]);
    }

    await client.query('RELEASE SAVEPOINT sp_products_kits_price');
  } catch (error) {
    try {
      await client.query('ROLLBACK TO SAVEPOINT sp_products_kits_price');
      await client.query('RELEASE SAVEPOINT sp_products_kits_price');
    } catch {}

    console.warn('[productsKitsApi.syncProductPrice] ignored:', error.message);
  }
}
