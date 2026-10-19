// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ deleteItem.repository.js — CONSART ERP | Notas de Entrada               ║
// ║ Remove um item da NF-e de entrada                                        ║
// ╚══════════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  TB_III,
  q,
} from './_shared.js';

export async function deleteItem(id) {
  const res = await q(
    `DELETE FROM ${TB_III}
      WHERE inbound_item_id = $1
      RETURNING inbound_item_id`,
    [id]
  );
  return res.rowCount > 0;
}

export default deleteItem;
