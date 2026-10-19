// ╔════════════════════════════════════════════════════════════════════╗
// ║ sellerByOrdersRemove.repository.js — remove                        ║
// ║ Tabela: public."sellerByOrders"                                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './sellerByOrders.constants.js';
import { ok, bad } from './sellerByOrders.utils.js';

export async function remove(orderId, sellerId) {
  const oid = Number(orderId);
  const sid = Number(sellerId);
  if (!Number.isFinite(oid) || oid <= 0) return bad('orderId inválido');
  if (!Number.isFinite(sid) || sid <= 0) return bad('sellerId inválido');

  const { rowCount } = await pool.query(
    `DELETE FROM ${TB} WHERE order_id = $1 AND seller_id = $2`,
    [oid, sid]
  );

  if (!rowCount) return bad('NOT_FOUND');
  return ok({ removed: true });
}
