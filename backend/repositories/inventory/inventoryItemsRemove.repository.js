// ╔════════════════════════════════════════════════════════════════════╗
// ║ inventoryItemsRemove.repository.js — removeItemFromInventory       ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_ITEMS } from './inventory.constants.js';
import { q } from './inventory.utils.js';
import { rowToItem } from './inventory.mappers.js';

export async function removeItemFromInventory(inventory_id, inventory_item_id) {
  const { rows } = await q(
    pool,
    'items.removeFromInventory',
    `DELETE FROM ${TB_ITEMS}
      WHERE inventory_id = $1 AND inventory_item_id = $2
      RETURNING *;`,
    [inventory_id, inventory_item_id],
  );
  return rows[0] ? rowToItem(rows[0]) : null;
}
