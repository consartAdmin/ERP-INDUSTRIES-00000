// ╔════════════════════════════════════════════════════════════════════╗
// ║ unitsSchema.repository.js — ensureTable (+ trigger updated_at)     ║
// ║ Tabela: public.units                                               ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './units.constants.js';

export async function ensureTable() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS ${TB} (
        unit_id     SERIAL PRIMARY KEY,
        unit        VARCHAR(50) NOT NULL UNIQUE,
        description VARCHAR(100),
        fator       NUMERIC(10,3) DEFAULT 1,
        is_active   BOOLEAN DEFAULT TRUE,
        created_at  TIMESTAMP DEFAULT NOW(),
        updated_at  TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE OR REPLACE FUNCTION public.trg_set_timestamp_units()
      RETURNS trigger AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END; $$ LANGUAGE plpgsql;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_units') THEN
          CREATE TRIGGER set_timestamp_units
          BEFORE UPDATE ON ${TB}
          FOR EACH ROW
          EXECUTE PROCEDURE public.trg_set_timestamp_units();
        END IF;
      END $$;
    `);

    await client.query('COMMIT');
    return { ok: true };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
