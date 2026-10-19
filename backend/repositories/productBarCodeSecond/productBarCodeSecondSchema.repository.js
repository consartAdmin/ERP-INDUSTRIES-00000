// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ productBarCodeSecondSchema.repository.js — ensure table / FKs / índices ║
// ║ Tabela principal: public."productBarCodeSecond"                          ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, COLS, DEFAULT_PRICE_ID } from './productBarCodeSecond.constants.js';

// ──────────────────────────────────────────────────────────────────────────────
// DDL / índices / triggers
// ──────────────────────────────────────────────────────────────────────────────
export async function ensureProductBarCodeSecondTable() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Tabela base (já inclui price_id para novas instalações)
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.${TB} (
        ${COLS.id}              SERIAL PRIMARY KEY,
        ${COLS.product_code}    VARCHAR(50)  NOT NULL,
        ${COLS.product_unit_id} INTEGER      NOT NULL,
        ${COLS.second_bar_code} VARCHAR(100) NOT NULL,
        ${COLS.code_type}       VARCHAR(50)  DEFAULT 'EAN-13',
        ${COLS.price_id}        INTEGER      DEFAULT ${DEFAULT_PRICE_ID},
        ${COLS.created_at}      TIMESTAMP    DEFAULT NOW(),
        ${COLS.updated_at}      TIMESTAMP    DEFAULT NOW()
      );
    `);

    // Garante coluna price_id em bases já existentes
    await client.query(`
      ALTER TABLE public.${TB}
      ADD COLUMN IF NOT EXISTS ${COLS.price_id} INTEGER;
    `);

    // Define default = 2 (ATCDO.)
    await client.query(`
      ALTER TABLE public.${TB}
        ALTER COLUMN ${COLS.price_id} SET DEFAULT ${DEFAULT_PRICE_ID};
    `);

    // Atualiza registros antigos nulos para 2
    await client.query(`
      UPDATE public.${TB}
         SET ${COLS.price_id} = ${DEFAULT_PRICE_ID}
       WHERE ${COLS.price_id} IS NULL;
    `);

    // Garante NOT NULL
    await client.query(`
      ALTER TABLE public.${TB}
        ALTER COLUMN ${COLS.price_id} SET NOT NULL;
    `);

    // FK → products(product_code)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
           WHERE conrelid = 'public.${TB}'::regclass
             AND conname  = 'pbs_product_fk'
        ) THEN
          ALTER TABLE public.${TB}
            ADD CONSTRAINT pbs_product_fk
            FOREIGN KEY (${COLS.product_code})
            REFERENCES public."products"(product_code)
            ON UPDATE CASCADE
            ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    // FK → productsUnits(product_unit_id)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
           WHERE conrelid = 'public.${TB}'::regclass
             AND conname  = 'pbs_product_unit_fk'
        ) THEN
          ALTER TABLE public.${TB}
            ADD CONSTRAINT pbs_product_unit_fk
            FOREIGN KEY (${COLS.product_unit_id})
            REFERENCES public."productsUnits"(product_unit_id)
            ON UPDATE CASCADE
            ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    // FK → prices(price_id)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
           WHERE conrelid = 'public.${TB}'::regclass
             AND conname  = 'pbs_price_fk'
        ) THEN
          ALTER TABLE public.${TB}
            ADD CONSTRAINT pbs_price_fk
            FOREIGN KEY (${COLS.price_id})
            REFERENCES public."prices"(price_id)
            ON UPDATE CASCADE;
        END IF;
      END $$;
    `);

    // Índice para busca por código de barras
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pbs_second_bar_code
        ON public.${TB}(${COLS.second_bar_code});
    `);

    // Índice por price_id (útil para relatórios)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pbs_price_id
        ON public.${TB}(${COLS.price_id});
    `);

    // Unicidade: mesmo produto + unidade + código não repete
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_pbs_unique_entry
        ON public.${TB}(${COLS.product_code}, ${COLS.product_unit_id}, ${COLS.second_bar_code});
    `);

    // Função genérica de timestamp (reutilizável)
    await client.query(`
      CREATE OR REPLACE FUNCTION trg_set_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.${COLS.updated_at} = NOW();
        RETURN NEW;
      END; $$ LANGUAGE plpgsql;
    `);

    // Trigger updated_at para esta tabela
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_pbs') THEN
          CREATE TRIGGER set_timestamp_pbs
          BEFORE UPDATE ON public.${TB}
          FOR EACH ROW
          EXECUTE PROCEDURE trg_set_timestamp();
        END IF;
      END $$;
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
