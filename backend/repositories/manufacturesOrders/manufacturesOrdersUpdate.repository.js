// ╔════════════════════════════════════════════════════════════════════╗
// ║ manufacturesOrdersUpdate.repository.js — update / updateItem       ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_ORDERS, TB_ITEMS } from './manufacturesOrders.constants.js';
import { toNumber, safeText } from './manufacturesOrders.sanitizers.js';
import { recalcTotal } from './manufacturesOrdersSupport.repository.js';

export async function update(id, payload = {}) {
  const { rows } = await pool.query(`
    UPDATE ${TB_ORDERS}
       SET manufacturer_id = COALESCE($2, manufacturer_id),
           manufacturer_name = COALESCE($3, manufacturer_name),
           status = COALESCE($4, status),
           notes = COALESCE($5, notes),
           updated_at = NOW()
     WHERE manufacture_order_id = $1
     RETURNING *
  `, [
    id,
    payload.manufacturer_id || null,
    safeText(payload.manufacturer_name),
    safeText(payload.status),
    safeText(payload.notes),
  ]);

  return rows[0] || null;
}

export async function updateItem(itemId, payload = {}) {
  const quantity = payload.quantity !== undefined ? toNumber(payload.quantity) : null;
  const costPrice = payload.cost_price !== undefined ? toNumber(payload.cost_price) : null;

  const { rows } = await pool.query(`
    UPDATE ${TB_ITEMS}
       SET quantity = COALESCE($2, quantity),
           cost_price = COALESCE($3, cost_price),
           unit = COALESCE($4, unit),
           description = COALESCE($5, description)
     WHERE manufacture_order_item_id = $1
     RETURNING *
  `, [
    itemId,
    quantity,
    costPrice,
    safeText(payload.unit),
    safeText(payload.description),
  ]);

  const item = rows[0];
  if (item) await recalcTotal(pool, item.manufacture_order_id);

  return item || null;
}
