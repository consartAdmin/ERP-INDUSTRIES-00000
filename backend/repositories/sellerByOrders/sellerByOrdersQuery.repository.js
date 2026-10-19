// ╔════════════════════════════════════════════════════════════════════╗
// ║ sellerByOrdersQuery.repository.js — listByOrder                    ║
// ║ Tabela: public."sellerByOrders"                                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './sellerByOrders.constants.js';
import { ok, bad } from './sellerByOrders.utils.js';

export async function listByOrder(orderId) {
  const id = Number(orderId);
  if (!Number.isFinite(id) || id <= 0) return bad('orderId inválido');

  const { rows } = await pool.query(
    `
    SELECT
      id, order_id, seller_id, seller_name, seller_email, seller_phone,
      role, commission_pct, commission_value, notes,
      created_at, updated_at
    FROM ${TB}
    WHERE order_id = $1
    ORDER BY (role = 'PRINCIPAL') DESC, id ASC
    `,
    [id]
  );

  return ok({ rows });
}
