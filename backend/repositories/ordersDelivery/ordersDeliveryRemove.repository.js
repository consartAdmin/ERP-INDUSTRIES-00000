// ╔════════════════════════════════════════════════════════════════════╗
// ║ ordersDeliveryRemove.repository.js — removeByOrderId               ║
// ║ Tabela: public."ordersDelivery"                                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './ordersDelivery.constants.js';
import { toInt } from './ordersDelivery.sanitizers.js';

export async function removeByOrderId(orderId) {
  const id = toInt(orderId);
  if (!id || id <= 0) throw new Error('order_id inválido');

  const r = await pool.query(`DELETE FROM ${TB} WHERE order_id=$1 RETURNING order_id`, [id]);
  return { ok: true, deleted: r.rowCount > 0 };
}
