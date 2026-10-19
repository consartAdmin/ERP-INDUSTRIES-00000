// ╔════════════════════════════════════════════════════════════════════╗
// ║ prices.schema.js — DDL: ensurePricesTable                          ║
// ║ Tabela: public."prices"                                            ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_PRICES } from './prices.constants.js';

export async function ensurePricesTable() {
  const ddl = `
    CREATE TABLE IF NOT EXISTS ${TB_PRICES} (
      price_id    SERIAL PRIMARY KEY,
      name        VARCHAR(100) NOT NULL,
      description TEXT,
      active      BOOLEAN NOT NULL DEFAULT TRUE,
      created_at  TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at  TIMESTAMP WITHOUT TIME ZONE
    );

    CREATE INDEX IF NOT EXISTS idx_prices_name ON ${TB_PRICES}(name);

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'prices_name_unique'
      ) THEN
        ALTER TABLE ${TB_PRICES}
          ADD CONSTRAINT prices_name_unique UNIQUE (name);
      END IF;
    END$$;
  `;

  await pool.query(ddl);
}
