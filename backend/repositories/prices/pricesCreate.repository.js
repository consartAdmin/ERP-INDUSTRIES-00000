// ╔════════════════════════════════════════════════════════════════════╗
// ║ pricesCreate.repository.js — create                                ║
// ║ Tabela: public."prices"                                            ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_PRICES } from './prices.constants.js';
import { ensurePricesTable } from './prices.schema.js';

export async function create({ name, description = null, active = true }) {
  await ensurePricesTable();
  const rs = await pool.query(
    `
      INSERT INTO ${TB_PRICES}(name, description, active, created_at, updated_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING price_id, name, description, active, created_at, updated_at
    `,
    [String(name).trim(), description, !!active]
  );
  return rs.rows[0];
}
