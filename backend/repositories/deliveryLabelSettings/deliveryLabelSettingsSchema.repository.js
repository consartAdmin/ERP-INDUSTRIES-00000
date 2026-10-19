// ╔════════════════════════════════════════════════════════════════════╗
// ║ deliveryLabelSettingsSchema.repository.js — ensureTable / ready    ║
// ║ Criação preguiçosa (memoizada) da tabela de parâmetros             ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './deliveryLabelSettings.constants.js';

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${TB} (
      id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      settings JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

let tableReady = null;

export function ready() {
  if (!tableReady) {
    tableReady = ensureTable().catch((error) => {
      tableReady = null;
      throw error;
    });
  }
  return tableReady;
}
