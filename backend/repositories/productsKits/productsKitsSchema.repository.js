// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsKitsSchema.repository.js — ensureProductsKitsTables        ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_KITS, TB_ITEMS } from './productsKits.constants.js';

export async function ensureProductsKitsTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${TB_KITS} (
      id BIGSERIAL PRIMARY KEY,
      kit_sku VARCHAR(60) NOT NULL,
      kit_description TEXT NOT NULL,
      price_mode VARCHAR(20) DEFAULT 'MANUAL',
      sale_price NUMERIC(14,2) DEFAULT 0,
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${TB_ITEMS} (
      id BIGSERIAL PRIMARY KEY,
      kit_id BIGINT NOT NULL REFERENCES ${TB_KITS}(id) ON DELETE CASCADE,
      product_sku VARCHAR(60) NOT NULL,
      description TEXT,
      unit VARCHAR(20),
      unit_factor NUMERIC(14,6) NOT NULL DEFAULT 1,
      quantity NUMERIC(14,3) NOT NULL DEFAULT 1,
      cost_unit NUMERIC(14,4) DEFAULT 0,
      sale_price_unit NUMERIC(14,4) DEFAULT 0,
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    ALTER TABLE ${TB_ITEMS}
    ADD COLUMN IF NOT EXISTS unit_factor NUMERIC(14,6) NOT NULL DEFAULT 1;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_products_kits_sku
    ON ${TB_KITS} (kit_sku);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_products_kits_items_kit_id
    ON ${TB_ITEMS} (kit_id);
  `);
}
