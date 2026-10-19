// ╔════════════════════════════════════════════════════════════════════╗
// ║ inventoryCreate.repository.js — create                             ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_INV } from './inventory.constants.js';
import { q } from './inventory.utils.js';
import { rowToInventory } from './inventory.mappers.js';

export async function create(payload = {}) {
  const {
    code,
    description = null,
    type = 'GENERAL',
    status = 'OPEN',
    reference_date,
    notes = null,
    created_by = null,
  } = payload;

  if (!code) throw new Error('Code is required');
  if (!reference_date) throw new Error('Reference date is required');

  const { rows } = await q(
    pool,
    'inventory.create',
    `
    INSERT INTO ${TB_INV}
      (code, description, type, status, reference_date, notes, created_by)
    VALUES ($1, $2, UPPER($3), UPPER($4), $5, $6, $7)
    RETURNING *;
    `,
    [code.trim(), description, type, status, reference_date, notes, created_by],
  );

  return rowToInventory(rows[0]);
}
