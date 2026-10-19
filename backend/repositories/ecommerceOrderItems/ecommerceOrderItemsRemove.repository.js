// ╔════════════════════════════════════════════════════════════════════╗
// ║ ecommerceOrderItemsRemove.repository.js — deleteItemsByOrder       ║
// ║ Tabela: "ecommerceOrderItems"                                      ║
// ╚════════════════════════════════════════════════════════════════════╝

import { q } from './ecommerceOrderItems.utils.js';

export async function deleteItemsByOrder(order_id) {
  const res = await q(
    `DELETE FROM "ecommerceOrderItems" WHERE order_id = $1`,
    [order_id]
  );
  return res.rowCount > 0;
}
