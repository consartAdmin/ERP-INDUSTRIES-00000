// ╔════════════════════════════════════════════════════════════════════╗
// ║ inventoryRemove.repository.js — remove                             ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_INV } from './inventory.constants.js';
import { q } from './inventory.utils.js';
import { rowToInventory } from './inventory.mappers.js';

export async function remove(inventory_id) {
  const { rows } = await q(
    pool,
    'inventory.remove',
    `DELETE FROM ${TB_INV} WHERE inventory_id = $1 RETURNING *;`,
    [inventory_id],
  );
  return rows[0] ? rowToInventory(rows[0]) : null;
}
