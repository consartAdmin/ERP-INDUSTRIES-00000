// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerSubSegmentsSchema.repository.js — ensureTable()            ║
// ║ Tabela: public."customerSubSegments" (DDL idempotente)             ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, ALIAS, nowSql } from './customerSubSegments.constants.js';

/* ──────────────────────────────────────────────────────────────
   ensureTable()
────────────────────────────────────────────────────────────── */
export async function ensureTable() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS ${TB} (
        subsegment_id   SERIAL PRIMARY KEY,
        segment_id      INTEGER      NOT NULL,
        subsegment_name VARCHAR(160) NOT NULL,
        subsegment_code VARCHAR(40)  UNIQUE,
        description     TEXT,
        is_active       BOOLEAN      DEFAULT TRUE,
        created_at      TIMESTAMP    DEFAULT ${nowSql},
        updated_at      TIMESTAMP    DEFAULT ${nowSql},
        version         INTEGER      DEFAULT 1,
        source_system   VARCHAR(50),
        source_hash     VARCHAR(120)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_customersubsegments_name
      ON ${TB} (LOWER(subsegment_name));
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_customersubsegments_segment
      ON ${TB} (segment_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_customersubsegments_active
      ON ${TB} (is_active);
    `);

    await client.query(`
      CREATE OR REPLACE FUNCTION set_timestamp_customersubsegments()
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
          EXECUTE FUNCTION set_timestamp_customersubsegments();
        END IF;
      END$$;
    `);

    await client.query('COMMIT');
    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ ensureTable(customerSubSegments) error:', err.message);
    throw err;
  } finally {
    client.release();
  }
}
