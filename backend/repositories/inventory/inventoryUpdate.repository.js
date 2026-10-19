// ╔════════════════════════════════════════════════════════════════════╗
// ║ inventoryUpdate.repository.js — update                             ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_INV } from './inventory.constants.js';
import { q } from './inventory.utils.js';
import { rowToInventory } from './inventory.mappers.js';
import { getById } from './inventoryQuery.repository.js';

export async function update(inventory_id, payload = {}) {
  const fields = [];
  const params = [];
  let idx = 1;

  const map = {
    code: payload.code?.trim(),
    description: payload.description ?? null,
    type: payload.type ? payload.type.toUpperCase() : undefined,
    status: payload.status ? payload.status.toUpperCase() : undefined,
    reference_date: payload.reference_date ?? null,
    notes: payload.notes ?? null,
    finalized_by: payload.finalized_by ?? undefined,
  };

  for (const [col, val] of Object.entries(map)) {
    if (val !== undefined) {
      fields.push(`${col} = $${idx++}`);
      params.push(val);
    }
  }

  if (!fields.length) return getById(inventory_id);

  params.push(inventory_id);

  const sql = `
    UPDATE ${TB_INV}
       SET ${fields.join(', ')},
           updated_at = NOW()
     WHERE inventory_id = $${idx}
     RETURNING *;
  `;

  const { rows } = await q(pool, 'inventory.update', sql, params);
  return rows[0] ? rowToInventory(rows[0]) : null;
}
