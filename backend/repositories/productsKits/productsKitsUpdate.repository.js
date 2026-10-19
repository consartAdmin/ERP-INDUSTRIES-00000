// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsKitsUpdate.repository.js — updateProductsKit               ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_KITS, TB_ITEMS } from './productsKits.constants.js';
import { toNum, normalizeBool } from './productsKits.sanitizers.js';
import { calculateTotals } from './productsKits.utils.js';
import { getFirstItemProductData, syncProductPrice } from './productsKitsProduct.repository.js';
import { ensureProductsKitsTables } from './productsKitsSchema.repository.js';
import { getProductsKitById } from './productsKitsQuery.repository.js';

export async function updateProductsKit(id, data) {
  await ensureProductsKitsTables();

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const {
      kit_sku,
      kit_description,
      price_mode = 'MANUAL',
      sale_price = 0,
      active = true,
      items = [],
    } = data;

    if (!kit_description) throw new Error('kit_description is required');

    const { totalCost, totalSale } = calculateTotals(items);
    const finalSalePrice = price_mode === 'SUM_ITEMS'
      ? totalSale
      : toNum(sale_price, totalSale);

    const currentKit = await client.query(`
      SELECT *
      FROM ${TB_KITS}
      WHERE id = $1
      LIMIT 1
    `, [id]);

    if (!currentKit.rows.length) throw new Error('Products kit not found');

    const currentSku = currentKit.rows[0].kit_sku;
    const finalKitSku = kit_sku || currentSku;

    const firstProduct = await getFirstItemProductData(client, items);
    const productUnitId = firstProduct?.product_unit_id || null;

    const productResult = await client.query(`
      UPDATE public.products
      SET
        description = $1,
        cost_price = $2,
        product_unit_id = $3,
        product_grade_id = COALESCE($4, product_grade_id),
        product_price_id = COALESCE($5, product_price_id),
        products_fiscal_id = COALESCE($6, products_fiscal_id),
        supplier_id = COALESCE($7, supplier_id),
        manufacturer_id = COALESCE($8, manufacturer_id),
        is_active = $9,
        updated_at = NOW()
      WHERE product_code = $10
      RETURNING product_id, product_code
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
      finalKitSku,
    ]);

    if (productResult.rows[0]?.product_id) {
      await syncProductPrice(client, productResult.rows[0].product_id, finalSalePrice);
    }

    await client.query(`
      UPDATE ${TB_KITS}
      SET
        kit_sku = $1,
        kit_description = $2,
        price_mode = $3,
        sale_price = $4,
        active = $5,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
    `, [
      finalKitSku,
      kit_description,
      price_mode,
      finalSalePrice,
      normalizeBool(active),
      id,
    ]);

    await client.query(`
      DELETE FROM ${TB_ITEMS}
      WHERE kit_id = $1
    `, [id]);

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
          ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        id,
        item.product_sku,
        item.description || '',
        item.unit || '',
        toNum(item.unit_factor || item.fator || item.factor, 1),
        toNum(item.quantity, 1),
        toNum(item.cost_unit, 0),
        toNum(item.sale_price_unit, 0),
        item.active !== false,
      ]);
    }

    await client.query('COMMIT');

    return await getProductsKitById(id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
