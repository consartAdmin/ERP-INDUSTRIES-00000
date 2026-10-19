// ╔════════════════════════════════════════════════════════════════════╗
// ║ signaturesDeliveriesUpdate.repository.js — update por id           ║
// ║ Tabela: public."signaturesDeliveries"                              ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './signaturesDeliveries.constants.js';
import { normalizePayload } from './signaturesDeliveries.sanitizers.js';
import { rowToModel } from './signaturesDeliveries.mappers.js';
import { getById } from './signaturesDeliveriesQuery.repository.js';

export async function update(id, data = {}) {
  const normalized = normalizePayload(data);

  const sets = [];
  const vals = [];
  let i = 1;

  for (const [k, v] of Object.entries(normalized)) {
    if (v === undefined) continue;
    sets.push(`${k} = $${i}`);
    vals.push(v);
    i++;
  }

  if (!sets.length) {
    return getById(id);
  }

  const sql = `
    UPDATE ${TB}
    SET ${sets.join(', ')}, updated_at = NOW()
    WHERE id = $${i}
    RETURNING *;
  `;

  vals.push(Number(id));
  const { rows } = await pool.query(sql, vals);
  return rowToModel(rows[0]);
}
