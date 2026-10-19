// ╔════════════════════════════════════════════════════════════════════╗
// ║ signaturesDeliveriesRemove.repository.js — remove (delete          ║
// ║ definitivo da assinatura)                                          ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './signaturesDeliveries.constants.js';
import { rowToModel } from './signaturesDeliveries.mappers.js';

export async function remove(id) {
  const { rows } = await pool.query(
    `
    DELETE FROM ${TB}
    WHERE id = $1
    RETURNING *;
    `,
    [Number(id)]
  );
  return rowToModel(rows[0]);
}
