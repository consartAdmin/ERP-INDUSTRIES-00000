// ╔══════════════════════════════════════════════════════════════════════╗
// ║ userTablePreferencesSchema.repository.js — ensureTable (idempotente) ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './userTablePreferences.constants.js';

let ensured = null;

/** Cria a tabela na primeira chamada (uma vez por processo). */
export function ensureTable() {
  if (!ensured) {
    ensured = pool.query(`
      CREATE TABLE IF NOT EXISTS ${TB} (
        id          BIGSERIAL PRIMARY KEY,
        user_id     INTEGER NOT NULL,
        table_key   VARCHAR(80) NOT NULL,
        prefs       JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_user_table_prefs UNIQUE (user_id, table_key)
      );
    `).catch((err) => {
      ensured = null; // tenta de novo na próxima chamada
      throw err;
    });
  }
  return ensured;
}
