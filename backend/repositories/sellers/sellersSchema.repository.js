// ╔════════════════════════════════════════════════════════════════════╗
// ║ sellersSchema.repository.js — ensureTable idempotente              ║
// ║ Tabela: public."sellers"                                           ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './sellers.constants.js';

export async function ensureTable() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Cria tabela, se não existir
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${TB} (
        id               SERIAL PRIMARY KEY,
        name             VARCHAR(150) NOT NULL,
        nickname         VARCHAR(100),
        document         VARCHAR(20),
        email            VARCHAR(150),
        phone            VARCHAR(30),
        mobile           VARCHAR(30),
        active           BOOLEAN DEFAULT TRUE,
        commission_type  VARCHAR(20) DEFAULT 'PERCENT',
        commission_value NUMERIC(10,4) DEFAULT 0,
        observations     TEXT,
        created_at       TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
        updated_at       TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
      );
    `);

    // Garante colunas (caso tabela já existisse antiga)
    await client.query(`
      ALTER TABLE ${TB}
        ADD COLUMN IF NOT EXISTS id               SERIAL,
        ADD COLUMN IF NOT EXISTS name             VARCHAR(150),
        ADD COLUMN IF NOT EXISTS nickname         VARCHAR(100),
        ADD COLUMN IF NOT EXISTS document         VARCHAR(20),
        ADD COLUMN IF NOT EXISTS email            VARCHAR(150),
        ADD COLUMN IF NOT EXISTS phone            VARCHAR(30),
        ADD COLUMN IF NOT EXISTS mobile           VARCHAR(30),
        ADD COLUMN IF NOT EXISTS active           BOOLEAN DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS commission_type  VARCHAR(20) DEFAULT 'PERCENT',
        ADD COLUMN IF NOT EXISTS commission_value NUMERIC(10,4) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS observations     TEXT,
        ADD COLUMN IF NOT EXISTS created_at       TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW();
    `);

    // Índices úteis
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sellers_name
        ON ${TB} (name);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sellers_document
        ON ${TB} (document);
    `);

    // Função de updated_at (usa mesma ideia do padrão do seu banco)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_proc WHERE proname = 'trg_sellers_set_timestamp'
        ) THEN
          CREATE OR REPLACE FUNCTION trg_sellers_set_timestamp()
          RETURNS TRIGGER AS $body$
          BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
          END;
          $body$ LANGUAGE plpgsql;
        END IF;
      END $$;
    `);

    // Trigger de updated_at
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sellers_set_timestamp'
        ) THEN
          CREATE TRIGGER trg_sellers_set_timestamp
          BEFORE UPDATE ON ${TB}
          FOR EACH ROW
          EXECUTE PROCEDURE trg_sellers_set_timestamp();
        END IF;
      END $$;
    `);

    await client.query('COMMIT');
    return { ok: true, table: 'sellers', message: 'ensureTable() sellers ok' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
