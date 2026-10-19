// ╔════════════════════════════════════════════════════════════════════╗
// ║ pricesUpdate.repository.js — update / softDelete / restore         ║
// ║ Tabela: public."prices"                                            ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_PRICES } from './prices.constants.js';
import { ensurePricesTable } from './prices.schema.js';

export async function update(id, { name = null, description = null, active = null }) {
  await ensurePricesTable();
  const rs = await pool.query(
    `
      UPDATE ${TB_PRICES}
      SET
        name        = COALESCE($1, name),
        description = COALESCE($2, description),
        active      = COALESCE($3, active),
        updated_at  = CURRENT_TIMESTAMP
      WHERE price_id = $4
      RETURNING price_id, name, description, active, created_at, updated_at
    `,
    [
      name !== null && name !== undefined ? String(name).trim() : null,
      description !== undefined ? description : null,
      active !== undefined ? !!active : null,
      id
    ]
  );
  return rs.rows?.[0] || null;
}

export async function softDelete(id) {
  await ensurePricesTable();
  const rs = await pool.query(
    `
      UPDATE ${TB_PRICES}
      SET active = false, updated_at = CURRENT_TIMESTAMP
      WHERE price_id = $1
      RETURNING price_id, name, description, active, created_at, updated_at
    `,
    [id]
  );
  return rs.rows?.[0] || null;
}

export async function restore(id) {
  await ensurePricesTable();
  const rs = await pool.query(
    `
      UPDATE ${TB_PRICES}
      SET active = true, updated_at = CURRENT_TIMESTAMP
      WHERE price_id = $1
      RETURNING price_id, name, description, active, created_at, updated_at
    `,
    [id]
  );
  return rs.rows?.[0] || null;
}
