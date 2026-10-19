// ╔════════════════════════════════════════════════════════════════════╗
// ║ manufacturesOrdersRemove.repository.js — removeItem / remove       ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_ORDERS, TB_ITEMS } from './manufacturesOrders.constants.js';
import { recalcTotal } from './manufacturesOrdersSupport.repository.js';

export async function removeItem(itemId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows } = await client.query(`
      DELETE FROM ${TB_ITEMS}
      WHERE manufacture_order_item_id = $1
      RETURNING manufacture_order_id
    `, [itemId]);

    const orderId = rows[0]?.manufacture_order_id;

    if (orderId) await recalcTotal(client, orderId);

    await client.query('COMMIT');

    return { removed: !!orderId, manufacture_order_id: orderId };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function remove(id) {
  const { rowCount } = await pool.query(`
    DELETE FROM ${TB_ORDERS}
    WHERE manufacture_order_id = $1
  `, [id]);

  return { removed: rowCount > 0 };
}
