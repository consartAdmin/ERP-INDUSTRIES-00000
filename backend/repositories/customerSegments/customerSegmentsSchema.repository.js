// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerSegmentsSchema.repository.js — ensureTable()               ║
// ║ Tabela: public."customerSegments" (DDL idempotente)                ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, ALIAS, nowSql } from './customerSegments.constants.js';

/* ──────────────────────────────────────────────────────────────
   ensureTable()
────────────────────────────────────────────────────────────── */
export async function ensureTable() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS ${TB} (
        segment_id    BIGSERIAL PRIMARY KEY,
        segment_code  VARCHAR(30) UNIQUE,
        segment_name  VARCHAR(120) NOT NULL,
        description   TEXT,
        is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
        created_at    TIMESTAMPTZ  NOT NULL DEFAULT ${nowSql},
        updated_at    TIMESTAMPTZ  NOT NULL DEFAULT ${nowSql}
      );
    `);

    // ✅ Para tabelas antigas que já tinham NOT NULL em segment_code
    await client.query(`
      ALTER TABLE ${TB}
      ALTER COLUMN segment_code DROP NOT NULL;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_customersegments_name
      ON ${TB} (LOWER(segment_name));
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_customersegments_active
      ON ${TB} (is_active);
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_customersegments_code_unique
      ON ${TB} (LOWER(segment_code))
      WHERE segment_code IS NOT NULL;
    `);

    await client.query(`
      CREATE OR REPLACE FUNCTION set_timestamp_customersegments()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'trg_${ALIAS}_set_timestamp'
        ) THEN
          CREATE TRIGGER trg_${ALIAS}_set_timestamp
          BEFORE UPDATE ON ${TB}
          FOR EACH ROW
          EXECUTE FUNCTION set_timestamp_customersegments();
        END IF;
      END$$;
    `);

    await client.query(`
      DO $$
      DECLARE
        seq_name text;
        max_id   bigint;
      BEGIN
        SELECT pg_get_serial_sequence('${TB}', 'segment_id') INTO seq_name;

        IF seq_name IS NOT NULL THEN
          EXECUTE format('SELECT COALESCE(MAX(segment_id),0) FROM ${TB}')
          INTO max_id;

          EXECUTE format(
            'SELECT setval(%L, GREATEST(%s,1), true)',
            seq_name,
            max_id
          );
        END IF;
      END$$;
    `);

    await client.query('COMMIT');
    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ ensureTable(customerSegments) error:', err.message);
    throw err;
  } finally {
    client.release();
  }
}
