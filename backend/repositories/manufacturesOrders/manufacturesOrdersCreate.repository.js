// ╔════════════════════════════════════════════════════════════════════╗
// ║ manufacturesOrdersCreate.repository.js — create / addItem          ║
// ║ (transação + recálculo do total)                                   ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_ORDERS, TB_ITEMS } from './manufacturesOrders.constants.js';
import { toNumber, safeText } from './manufacturesOrders.sanitizers.js';
import { generateOrderNumber, recalcTotal, resolveProductFromStock } from './manufacturesOrdersSupport.repository.js';
import { getById } from './manufacturesOrdersQuery.repository.js';

export async function create(payload = {}) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const orderNumber = safeText(payload.order_number) || await generateOrderNumber(client);

    const { rows } = await client.query(`
      INSERT INTO ${TB_ORDERS} (
        order_number,
        manufacturer_id,
        manufacturer_name,
        status,
        notes
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      orderNumber,
      payload.manufacturer_id || null,
      safeText(payload.manufacturer_name),
      safeText(payload.status, 'OPEN'),
      safeText(payload.notes),
    ]);

    const order = rows[0];

    const items = Array.isArray(payload.items) ? payload.items : [];

    for (const item of items) {
      await addItemTx(client, order.manufacture_order_id, item);
    }

    const updated = await recalcTotal(client, order.manufacture_order_id);

    await client.query('COMMIT');

    return getById(updated.manufacture_order_id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function addItemTx(client, manufactureOrderId, item = {}) {
  const productStockId = item.product_stock_id || null;
  const product = productStockId ? await resolveProductFromStock(productStockId) : null;

  const productCode =
    safeText(item.product_code) ||
    safeText(product?.product_code);

  const sku =
    safeText(item.sku) ||
    safeText(product?.sku) ||
    productCode;

  const description =
    safeText(item.description) ||
    safeText(product?.description) ||
    safeText(product?.name) ||
    '-';

  const unit =
    safeText(item.unit) ||
    safeText(product?.unit) ||
    'UN';

  const quantity = toNumber(item.quantity, 0);
  const costPrice = toNumber(
    item.cost_price ?? product?.cost_price,
    0
  );

  if (!quantity || quantity <= 0) {
    throw new Error('Quantidade inválida no item do pedido.');
  }

  await client.query(`
    INSERT INTO ${TB_ITEMS} (
      manufacture_order_id,
      product_stock_id,
      product_code,
      sku,
      description,
      unit,
      quantity,
      cost_price
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
  `, [
    manufactureOrderId,
    productStockId,
    productCode,
    sku,
    description,
    unit,
    quantity,
    costPrice,
  ]);
}

export async function addItem(manufactureOrderId, item = {}) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await addItemTx(client, manufactureOrderId, item);
    await recalcTotal(client, manufactureOrderId);

    await client.query('COMMIT');

    return getById(manufactureOrderId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
