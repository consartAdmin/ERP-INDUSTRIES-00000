// ╔════════════════════════════════════════════════════════════════════╗
// ║ sellerByOrdersSchema.repository.js — ensureTable                   ║
// ║ Tabela: public."sellerByOrders"                                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, TB_ORDERS } from './sellerByOrders.constants.js';
import { ok } from './sellerByOrders.utils.js';

export async function ensureTable() {
  // Mantém simples: você já tem o SQL acima, mas isso evita crash em ambiente novo
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${TB} (
      id BIGSERIAL PRIMARY KEY,
      order_id BIGINT NOT NULL REFERENCES ${TB_ORDERS}(order_id) ON DELETE CASCADE,
      seller_id BIGINT NOT NULL,
      seller_name VARCHAR(200),
      seller_email VARCHAR(180),
      seller_phone VARCHAR(30),
      role VARCHAR(30) NOT NULL DEFAULT 'PRINCIPAL',
      commission_pct NUMERIC(7,3) NOT NULL DEFAULT 0,
      commission_value NUMERIC(14,2) NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(order_id, seller_id)
    );
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_sbo_order_id  ON ${TB}(order_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_sbo_seller_id ON ${TB}(seller_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_sbo_role      ON ${TB}(role);`);
  return ok();
}
