// ╔════════════════════════════════════════════════════════════════════╗
// ║ ecommerceOrdersRemove.repository.js — deleteOrder                  ║
// ║ Tabela: "ecommerceOrders"                                          ║
// ╚════════════════════════════════════════════════════════════════════╝

import { q } from './ecommerceOrders.utils.js';

export async function deleteOrder(id) {
  const res = await q(
    `DELETE FROM "ecommerceOrders" WHERE id = $1 RETURNING id`,
    [id]
  );
  return res.rowCount > 0;
}
