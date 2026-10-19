// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsKitsCreate.repository.js — createProductsKit               ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_KITS, TB_ITEMS } from './productsKits.constants.js';
import { toNum, normalizeBool } from './productsKits.sanitizers.js';
import { calculateTotals } from './productsKits.utils.js';
import { getFirstItemProductData, syncProductPrice } from './productsKitsProduct.repository.js';
import { ensureProductsKitsTables } from './productsKitsSchema.repository.js';
import { getProductsKitById } from './productsKitsQuery.repository.js';

export async function createProductsKit(data) {
  await ensureProductsKitsTables();

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const {
      kit_description,
      price_mode = 'MANUAL',
      sale_price = 0,
      active = true,
      items = [],
    } = data;

    if (!kit_description) throw new Error('kit_description is required');
    if (!items.length) throw new Error('At least one kit item is required');

    const { totalCost, totalSale } = calculateTotals(items);
    const finalSalePrice = price_mode === 'SUM_ITEMS'
      ? totalSale
      : toNum(sale_price, totalSale);

    const firstProduct = await getFirstItemProductData(client, items);
    const productUnitId = firstProduct?.product_unit_id || null;

    const productResult = await client.query(`
      INSERT INTO public.products
        (
          description,
          cost_price,
          product_unit_id,
          product_grade_id,
          product_price_id,
          product_stock_id,
          products_fiscal_id,
          supplier_id,
          manufacturer_id,
          is_active
        )
      VALUES
        ($1, $2, $3, $4, $5, NULL, $6, $7, $8, $9)
      RETURNING
        product_id,
        product_code,
        description,
        product_unit_id,
        product_grade_id,
        product_price_id,
        product_stock_id,
        products_fiscal_id
    `, [
      kit_description,
      totalCost,
      productUnitId,
      firstProduct?.product_grade_id || null,
      firstProduct?.product_price_id || null,
      firstProduct?.products_fiscal_id || null,
      firstProduct?.supplier_id || null,
      firstProduct?.manufacturer_id || null,
      normalizeBool(active),
    ]);

    const product = productResult.rows[0];

    await syncProductPrice(client, product.product_id, finalSalePrice);

    const kitResult = await client.query(`
      INSERT INTO ${TB_KITS}
        (kit_sku, kit_description, price_mode, sale_price, active)
      VALUES
        ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      product.product_code,
      kit_description,
      price_mode,
      finalSalePrice,
      normalizeBool(active),
    ]);

    const kit = kitResult.rows[0];

    for (const item of items) {
      await client.query(`
        INSERT INTO ${TB_ITEMS}
          (
            kit_id,
            product_sku,
            description,
            unit,
            unit_factor,
            quantity,
            cost_unit,
            sale_price_unit,
            active
          )
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
      `, [
        kit.id,
        item.product_sku,
        item.description || '',
        item.unit || '',
        toNum(item.unit_factor || item.fator || item.factor, 1),
        toNum(item.quantity, 1),
        toNum(item.cost_unit, 0),
        toNum(item.sale_price_unit, 0),
      ]);
    }

    await client.query('COMMIT');

    return await getProductsKitById(kit.id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
