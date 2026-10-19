// ╔════════════════════════════════════════════════════════════════════╗
// ║ pricesRemove.repository.js — permanentDelete                       ║
// ║ Tabela: public."prices"                                            ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_PRICES } from './prices.constants.js';
import { ensurePricesTable } from './prices.schema.js';

export async function permanentDelete(id) {
  await ensurePricesTable();

  const rs = await pool.query(
    `
      DELETE FROM ${TB_PRICES}
      WHERE price_id = $1
      RETURNING
        price_id,
        name,
        description,
        active,
        created_at,
        updated_at
    `,
    [id],
  );

  return rs.rows?.[0] || null;
}
