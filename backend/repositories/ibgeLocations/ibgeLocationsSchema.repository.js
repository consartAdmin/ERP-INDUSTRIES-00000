// ╔════════════════════════════════════════════════════════════════════╗
// ║ ibgeLocationsSchema.repository.js — ensureTable idempotente        ║
// ║ Tabela, uniques, índices e trigger updated_at                      ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './ibgeLocations.constants.js';

/* =======================================================================
 * DDL / ensureTable idempotente
 * ======================================================================= */
export async function ensureTable() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS ${TB} (
        ibge_location_id SERIAL PRIMARY KEY,
        state            CHAR(2)     NOT NULL,
        city             TEXT        NOT NULL,
        ibge_code        INTEGER     NOT NULL,
        status           BOOLEAN     NOT NULL DEFAULT TRUE,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // ✅ evita "SERIAL duplicado" em ALTER TABLE (muito mais seguro)
    await client.query(`
      ALTER TABLE ${TB}
        ADD COLUMN IF NOT EXISTS state      CHAR(2),
        ADD COLUMN IF NOT EXISTS city       TEXT,
        ADD COLUMN IF NOT EXISTS ibge_code  INTEGER,
        ADD COLUMN IF NOT EXISTS status     BOOLEAN DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    `);

    // Uniques (sem duplicar)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_ibgelocations_state_city') THEN
          ALTER TABLE ${TB} ADD CONSTRAINT uq_ibgelocations_state_city UNIQUE (state, city);
        END IF;
      END $$;

      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_ibgelocations_ibge_code') THEN
          ALTER TABLE ${TB} ADD CONSTRAINT uq_ibgelocations_ibge_code UNIQUE (ibge_code);
        END IF;
      END $$;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ibgelocations_state  ON ${TB} (state);
      CREATE INDEX IF NOT EXISTS idx_ibgelocations_city   ON ${TB} (city);
      CREATE INDEX IF NOT EXISTS idx_ibgelocations_status ON ${TB} (status);
    `);

    // Trigger updated_at
    await client.query(`
      CREATE OR REPLACE FUNCTION public.trg_ibgelocations_set_timestamp()
      RETURNS TRIGGER AS $body$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $body$ LANGUAGE plpgsql;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ibgelocations_set_timestamp') THEN
          CREATE TRIGGER trg_ibgelocations_set_timestamp
          BEFORE UPDATE ON ${TB}
          FOR EACH ROW
          EXECUTE PROCEDURE public.trg_ibgelocations_set_timestamp();
        END IF;
      END $$;
    `);

    await client.query('COMMIT');
    return { ok: true, table: 'ibgeLocations', message: 'ensureTable() ibgeLocations ok' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
