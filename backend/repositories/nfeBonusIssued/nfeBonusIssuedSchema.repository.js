// ╔═══════════════════════════════════════════════════════════════════════╗
// ║ nfeBonusIssuedSchema.repository.js — NF-e Bonificação                 ║
// ║ ensureTables: DDL de nfeBonus / nfeBonusItems                         ║
// ╚═══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_BONUS, TB_BONUS_ITEMS, TB_OPERATION_TYPES, TB_CUSTOMERS, TB_PRODUCTS, TB_PRODUCT_GRADES, TB_STOCK_LOTS } from './nfeBonusIssued.constants.js';

// ======================================================================
// ENSURE TABLES
// ======================================================================

export async function ensureTables() {
  const sql = `
    CREATE TABLE IF NOT EXISTS ${TB_OPERATION_TYPES} (
      operation_type_id BIGSERIAL PRIMARY KEY,

      code VARCHAR(30) NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL,

      nature_operation VARCHAR(120) NOT NULL,

      cfop_internal VARCHAR(4),
      cfop_interstate VARCHAR(4),

      generates_receivable BOOLEAN NOT NULL DEFAULT FALSE,
      moves_stock BOOLEAN NOT NULL DEFAULT TRUE,

      active BOOLEAN NOT NULL DEFAULT TRUE,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );


    CREATE TABLE IF NOT EXISTS ${TB_BONUS} (
      bonus_id BIGSERIAL PRIMARY KEY,

      customer_id INTEGER NOT NULL
        REFERENCES ${TB_CUSTOMERS}(customer_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

      operation_type_id BIGINT NOT NULL
        REFERENCES ${TB_OPERATION_TYPES}(operation_type_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

      status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',

      total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,

      observations TEXT,

      invoice_id BIGINT,

      nfe_issue_status VARCHAR(40),
      nfe_provider_id TEXT,
      nfe_id_integracao TEXT,
      nfe_protocol TEXT,
      nfe_environment VARCHAR(20),
      nfe_access_key VARCHAR(44),
      nfe_issue_error TEXT,
      nfe_issued_at TIMESTAMPTZ,
      nfe_issued_by BIGINT,
      nfe_last_checked_at TIMESTAMPTZ,
      nfe_stock_moved_at TIMESTAMPTZ,

      created_by BIGINT,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );


    CREATE TABLE IF NOT EXISTS ${TB_BONUS_ITEMS} (
      bonus_item_id BIGSERIAL PRIMARY KEY,

      bonus_id BIGINT NOT NULL
        REFERENCES ${TB_BONUS}(bonus_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

      product_id INTEGER NOT NULL
        REFERENCES ${TB_PRODUCTS}(product_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

      product_code VARCHAR(50) NOT NULL
        REFERENCES ${TB_PRODUCTS}(product_code)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

      product_grade_id INTEGER
        REFERENCES ${TB_PRODUCT_GRADES}(product_grade_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

      lot_id BIGINT
        REFERENCES ${TB_STOCK_LOTS}(lot_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

      quantity NUMERIC(14,3) NOT NULL,

      unit_value NUMERIC(14,6) NOT NULL DEFAULT 0,
      total_value NUMERIC(14,2) NOT NULL DEFAULT 0,

      item_sequence INTEGER NOT NULL,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT chk_nfe_bonus_items_quantity
        CHECK (quantity > 0),

      CONSTRAINT chk_nfe_bonus_items_unit_value
        CHECK (unit_value >= 0),

      CONSTRAINT chk_nfe_bonus_items_total_value
        CHECK (total_value >= 0),

      CONSTRAINT ux_nfe_bonus_items_sequence
        UNIQUE (bonus_id, item_sequence)
    );


    CREATE INDEX IF NOT EXISTS idx_nfe_bonus_customer
      ON ${TB_BONUS}(customer_id);

    CREATE INDEX IF NOT EXISTS idx_nfe_bonus_status
      ON ${TB_BONUS}(status);

    CREATE INDEX IF NOT EXISTS idx_nfe_bonus_invoice
      ON ${TB_BONUS}(invoice_id);

    CREATE INDEX IF NOT EXISTS idx_nfe_bonus_created_at
      ON ${TB_BONUS}(created_at);


    CREATE INDEX IF NOT EXISTS idx_nfe_bonus_items_bonus
      ON ${TB_BONUS_ITEMS}(bonus_id);

    CREATE INDEX IF NOT EXISTS idx_nfe_bonus_items_product
      ON ${TB_BONUS_ITEMS}(product_id);

    CREATE INDEX IF NOT EXISTS idx_nfe_bonus_items_product_code
      ON ${TB_BONUS_ITEMS}(product_code);

    CREATE INDEX IF NOT EXISTS idx_nfe_bonus_items_lot
      ON ${TB_BONUS_ITEMS}(lot_id);

    ALTER TABLE ${TB_BONUS}
      ADD COLUMN IF NOT EXISTS nfe_issue_status VARCHAR(40),
      ADD COLUMN IF NOT EXISTS nfe_provider_id TEXT,
      ADD COLUMN IF NOT EXISTS nfe_id_integracao TEXT,
      ADD COLUMN IF NOT EXISTS nfe_protocol TEXT,
      ADD COLUMN IF NOT EXISTS nfe_environment VARCHAR(20),
      ADD COLUMN IF NOT EXISTS nfe_access_key VARCHAR(44),
      ADD COLUMN IF NOT EXISTS nfe_issue_error TEXT,
      ADD COLUMN IF NOT EXISTS nfe_issued_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS nfe_issued_by BIGINT,
      ADD COLUMN IF NOT EXISTS nfe_last_checked_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS nfe_stock_moved_at TIMESTAMPTZ;
  `;

  await pool.query(sql);

  return {
    ok: true,
  };
}
