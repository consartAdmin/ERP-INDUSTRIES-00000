// ╔════════════════════════════════════════════════════════════════════╗
// ║ ordersDeliveryGetById.repository.js — getByOrderId                 ║
// ║ Tabela: public."ordersDelivery"                                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './ordersDelivery.constants.js';
import { toInt } from './ordersDelivery.sanitizers.js';

export async function getByOrderId(orderId) {
  const id = toInt(orderId);
  if (!id || id <= 0) throw new Error('order_id inválido');

  const r = await pool.query(`SELECT * FROM ${TB} WHERE order_id=$1 LIMIT 1`, [id]);
  return r.rowCount ? r.rows[0] : null;
}
