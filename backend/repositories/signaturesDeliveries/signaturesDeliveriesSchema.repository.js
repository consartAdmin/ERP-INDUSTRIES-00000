// ╔════════════════════════════════════════════════════════════════════╗
// ║ signaturesDeliveriesSchema.repository.js — ensureTable idempotente ║
// ║ Tabela, colunas, índices, trigger updated_at e UNIQUE              ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './signaturesDeliveries.constants.js';

export async function ensureTable() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Cria tabela, se não existir
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${TB} (
        id              SERIAL PRIMARY KEY,
        order_id        INTEGER NOT NULL,
        nfe_key         VARCHAR(44) NOT NULL,
        signed_name     VARCHAR(255) NOT NULL,
        signature_image TEXT NOT NULL,
        created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
        updated_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
      );
    `);

    // Garante colunas (caso tabela já existisse antiga)
    await client.query(`
      ALTER TABLE ${TB}
        ADD COLUMN IF NOT EXISTS id              SERIAL,
        ADD COLUMN IF NOT EXISTS order_id        INTEGER,
        ADD COLUMN IF NOT EXISTS nfe_key         VARCHAR(44),
        ADD COLUMN IF NOT EXISTS signed_name     VARCHAR(255),
        ADD COLUMN IF NOT EXISTS signature_image TEXT,
        ADD COLUMN IF NOT EXISTS created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW();
    `);

    // Índices úteis
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_signaturesDeliveries_order_id
        ON ${TB} (order_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_signaturesDeliveries_nfe_key
        ON ${TB} (nfe_key);
    `);

    // Função de updated_at
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_proc WHERE proname = 'trg_signaturesDeliveries_set_timestamp'
        ) THEN
          CREATE OR REPLACE FUNCTION trg_signaturesDeliveries_set_timestamp()
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
          SELECT 1 FROM pg_trigger WHERE tgname = 'trg_signaturesDeliveries_set_timestamp'
        ) THEN
          CREATE TRIGGER trg_signaturesDeliveries_set_timestamp
          BEFORE UPDATE ON ${TB}
          FOR EACH ROW
          EXECUTE PROCEDURE trg_signaturesDeliveries_set_timestamp();
        END IF;
      END $$;
    `);

    // (Opcional) Único por pedido + chave NF-e
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM   pg_constraint
          WHERE  conname = 'signaturesDeliveries_order_nfe_uk'
        ) THEN
          ALTER TABLE ${TB}
            ADD CONSTRAINT signaturesDeliveries_order_nfe_uk
            UNIQUE (order_id, nfe_key);
        END IF;
      END;
      $$;
    `);

    await client.query('COMMIT');
    return { ok: true, table: 'signaturesDeliveries', message: 'ensureTable() signaturesDeliveries ok' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
