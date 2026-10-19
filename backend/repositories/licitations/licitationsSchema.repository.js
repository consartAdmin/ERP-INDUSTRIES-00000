// ╔════════════════════════════════════════════════════════════════════╗
// ║ licitationsSchema.repository.js — DDL + ensureTableReady (memo)    ║
// ║ Tabela: public.licitationitems                                     ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE_NAME } from './licitations.constants.js';

export async function ensureLicitationItemsTable() {
    await pool.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      id                    SERIAL PRIMARY KEY,
      process_number        VARCHAR(100),
      licitation_number     VARCHAR(100),
      portal                VARCHAR(100),
      portal_url            TEXT,
      agency_name           VARCHAR(255) NOT NULL,
      agency_document       VARCHAR(20),
      modality              VARCHAR(50),
      state                 CHAR(2),
      city                  VARCHAR(120),
      session_date          TIMESTAMP,
      proposal_deadline     TIMESTAMP,
      lot_number            VARCHAR(30),
      item_number           VARCHAR(30),
      product_description   TEXT NOT NULL,
      catmat_code           VARCHAR(50),
      catser_code           VARCHAR(50),
      quantity              NUMERIC(15,4),
      unit                  VARCHAR(20),
      estimated_unit_price  NUMERIC(15,4),
      estimated_total_price NUMERIC(15,2),
      product_id            INTEGER,
      sku                   VARCHAR(30),
      brand                 VARCHAR(120),
      manufacturer          VARCHAR(120),
      cost_price            NUMERIC(15,4),
      freight_cost          NUMERIC(15,4),
      tax_cost              NUMERIC(15,4),
      minimum_sale_price    NUMERIC(15,4),
      proposed_price        NUMERIC(15,4),
      estimated_margin      NUMERIC(8,2),
      participation         BOOLEAN DEFAULT FALSE,
      status                VARCHAR(30) DEFAULT 'FOUND',
      responsible           VARCHAR(120),
      observations          TEXT,
      created_at            TIMESTAMP DEFAULT NOW(),
      updated_at            TIMESTAMP DEFAULT NOW()
    );
  `);

    await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_licitation_items_status
      ON ${TABLE_NAME} (status);
  `);

    await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_licitation_items_session_date
      ON ${TABLE_NAME} (session_date);
  `);

    await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_licitation_items_agency_name
      ON ${TABLE_NAME} (agency_name);
  `);

    await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_licitation_items_process_number
      ON ${TABLE_NAME} (process_number);
  `);
}

let tableReadyPromise = null;

export async function ensureTableReady() {
    if (!tableReadyPromise) {
        tableReadyPromise = ensureLicitationItemsTable().catch((error) => {
            tableReadyPromise = null;
            throw error;
        });
    }

    return tableReadyPromise;
}
