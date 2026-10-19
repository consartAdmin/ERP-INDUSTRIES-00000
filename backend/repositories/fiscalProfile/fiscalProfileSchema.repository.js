// ╔════════════════════════════════════════════════════════════════════╗
// ║ fiscalProfileSchema.repository.js — ensureTable                    ║
// ║ DDL + trigger set_timestamp + ajuste da sequence                   ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, ALIAS, nowSql } from './fiscalProfile.constants.js';

export async function ensureTable() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${TB} (
        fiscal_profile_id SERIAL PRIMARY KEY,
        profile_name VARCHAR(100) NOT NULL,
        description TEXT,
        icms_cst VARCHAR(10),
        icms_rate NUMERIC(10,2),
        cfop_entry VARCHAR(10),
        cfop_exit VARCHAR(10),
        origin_code VARCHAR(5),
        pis_cst VARCHAR(10),
        pis_rate NUMERIC(10,2),
        cofins_cst VARCHAR(10),
        cofins_rate NUMERIC(10,2),
        benefit_code VARCHAR(50),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT ${nowSql},
        updated_at TIMESTAMP DEFAULT ${nowSql}
      );
    `);

    await client.query(`
      ALTER TABLE ${TB}
        ADD COLUMN IF NOT EXISTS is_cst VARCHAR(3),
        ADD COLUMN IF NOT EXISTS is_classification VARCHAR(10),
        ADD COLUMN IF NOT EXISTS is_rate NUMERIC(9,4) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS is_specific_rate NUMERIC(15,6) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS is_unit VARCHAR(6) DEFAULT 'UN',
        ADD COLUMN IF NOT EXISTS ibscbs_cst VARCHAR(3),
        ADD COLUMN IF NOT EXISTS ibscbs_classification VARCHAR(6),
        ADD COLUMN IF NOT EXISTS ibs_uf_rate NUMERIC(9,4) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS ibs_municipal_rate NUMERIC(9,4) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cbs_rate NUMERIC(9,4) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS donation_indicator SMALLINT DEFAULT 1,
        ADD COLUMN IF NOT EXISTS tax_reform_details JSONB
          NOT NULL DEFAULT '{}'::jsonb;
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_fiscalprofile_profile_name_unique
      ON ${TB} (LOWER(profile_name));
      CREATE INDEX IF NOT EXISTS idx_fiscalprofile_ibscbs_cst
      ON ${TB} (ibscbs_cst);
      CREATE INDEX IF NOT EXISTS idx_fiscalprofile_ibscbs_classification
      ON ${TB} (ibscbs_classification);
    `);

    await client.query(`
      CREATE OR REPLACE FUNCTION set_timestamp()
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
          FOR EACH ROW EXECUTE FUNCTION set_timestamp();
        END IF;
      END $$;
    `);

    await client.query(`
      SELECT setval(
        pg_get_serial_sequence('${TB}', 'fiscal_profile_id'),
        COALESCE(MAX(fiscal_profile_id), 1),
        MAX(fiscal_profile_id) IS NOT NULL
      )
      FROM ${TB};
    `);

    await client.query('COMMIT');
    return { ok: true };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
