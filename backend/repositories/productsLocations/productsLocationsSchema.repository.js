// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsLocationsSchema.repository.js — ensureTable (idempotente)    ║
// ║ ✅ FIX: UNIQUE com COALESCE agora via UNIQUE INDEX (Postgres)          ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './productsLocations.constants.js';

/* ────────────────────────────────────────────────────────────────────
   DDL — Criação da tabela e objetos auxiliares (idempotente)
──────────────────────────────────────────────────────────────────── */
export async function ensureTable() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1) Cria a tabela (se não existir) com o mínimo
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${TB} (
        id            BIGSERIAL PRIMARY KEY,
        product_code  VARCHAR(50) NOT NULL
      );
    `);

    // 2) Garante colunas ausentes (migração idempotente)
    await client.query(`ALTER TABLE ${TB} ADD COLUMN IF NOT EXISTS store_id    INTEGER;`);
    await client.query(`ALTER TABLE ${TB} ADD COLUMN IF NOT EXISTS corredor    VARCHAR(50);`);
    await client.query(`ALTER TABLE ${TB} ADD COLUMN IF NOT EXISTS prateleira  VARCHAR(50);`);
    await client.query(`ALTER TABLE ${TB} ADD COLUMN IF NOT EXISTS bandeja     VARCHAR(50);`);
    await client.query(`ALTER TABLE ${TB} ADD COLUMN IF NOT EXISTS box         VARCHAR(50);`);
    await client.query(`ALTER TABLE ${TB} ADD COLUMN IF NOT EXISTS observacao  TEXT;`);
    await client.query(`ALTER TABLE ${TB} ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();`);
    await client.query(`ALTER TABLE ${TB} ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();`);
    await client.query(`ALTER TABLE ${TB} ADD COLUMN IF NOT EXISTS is_active   BOOLEAN NOT NULL DEFAULT TRUE;`);

    // 3) Índices básicos
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pl_product_code
        ON ${TB} (product_code);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pl_store_product
        ON ${TB} (store_id, product_code);
    `);

    // ✅ 3.1) UNIQUE com COALESCE — via UNIQUE INDEX (Postgres)
    // Motivo: COALESCE em constraint UNIQUE NÃO é permitido.
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relkind = 'i'
            AND c.relname = 'uq_products_locations_store_product_place_idx'
            AND n.nspname = 'public'
        ) THEN
          EXECUTE '
            CREATE UNIQUE INDEX uq_products_locations_store_product_place_idx
            ON public."productsLocations" (
              store_id,
              product_code,
              COALESCE(corredor, ''''),
              COALESCE(prateleira, ''''),
              COALESCE(bandeja, ''''),
              COALESCE(box, '''')
            );
          ';
        END IF;
      END$$;
    `);

    // 4) Trigger de updated_at (reutiliza o padrão global)
    await client.query(`
      CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at := NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'trg_products_locations_set_updated_at'
        ) THEN
          CREATE TRIGGER trg_products_locations_set_updated_at
          BEFORE UPDATE ON ${TB}
          FOR EACH ROW
          EXECUTE FUNCTION public.set_updated_at_timestamp();
        END IF;
      END$$;
    `);

    // 5) Backfill defensivo
    await client.query(`
      UPDATE ${TB}
         SET is_active = TRUE
       WHERE is_active IS NULL;
    `);

    await client.query('COMMIT');
    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
