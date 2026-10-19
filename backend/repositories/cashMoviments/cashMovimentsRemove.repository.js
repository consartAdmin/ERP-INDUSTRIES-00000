// ╔════════════════════════════════════════════════════════════════════╗
// ║ cashMovimentsRemove.repository.js — deleteMovement                 ║
// ║ Tabelas: "cashMoviments" + "cashMovimentsAttachments"              ║
// ╚════════════════════════════════════════════════════════════════════╝

import { q } from './cashMoviments.utils.js';

export async function deleteMovement(id) {
  await q(
    `DELETE FROM "cashMovimentsAttachments" WHERE cash_movement_id = $1`,
    [Number(id)]
  );

  const res = await q(
    `DELETE FROM "cashMoviments" WHERE id = $1 RETURNING id`,
    [Number(id)]
  );

  return res.rowCount > 0;
}
