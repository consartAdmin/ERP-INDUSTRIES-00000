// ╔══════════════════════════════════════════════════════════════════════╗
// ║ pdv_loginsSchema.repository.js — ensureTable                         ║
// ║ Tabela: public.pdv_logins                                            ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE, DEFAULT_ROLE } from './pdv_logins.constants.js';

export async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE,
      full_name VARCHAR(120) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(30) DEFAULT '${DEFAULT_ROLE}',
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_pdv_logins_active
      ON ${TABLE} (active)
  `);
}
