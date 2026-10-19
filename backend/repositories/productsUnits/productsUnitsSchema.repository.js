// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsUnitsSchema.repository.js — ensureProductsUnitsTable       ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, UNITS_TB, COLS } from './productsUnits.constants.js';
import { checkProductsUnitsProductColumn, checkBarcodeColumn, checkPbcColumns, resetSchemaCache } from './productsUnitsCatalog.repository.js';

/* ──────────────────────────────────────────────────────────────────────────────
   Ensure (não destrói seu schema existente)
───────────────────────────────────────────────────────────────────────────── */
export async function ensureProductsUnitsTable() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Cria tabela se não existir.
    // ✅ Melhorado: já cria com product_code (padrão), mantendo product_id legado também.
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.${TB} (
        ${COLS.id}          BIGSERIAL PRIMARY KEY,
        product_code        VARCHAR(50)   NULL,
        product_id          VARCHAR(50)   NULL,
        ${COLS.unit_id}     INTEGER       NULL REFERENCES public.${UNITS_TB}(unit_id) ON DELETE SET NULL,
        ${COLS.unit}        VARCHAR(50)   NOT NULL,
        ${COLS.fator}       NUMERIC(10,3) DEFAULT 1,
        ${COLS.description} VARCHAR(100),
        ${COLS.barcode}     VARCHAR(50),
        ${COLS.standard}    BOOLEAN       DEFAULT FALSE,
        ${COLS.created_at}  TIMESTAMP     DEFAULT NOW(),
        ${COLS.updated_at}  TIMESTAMP     DEFAULT NOW(),
        ${COLS.is_active}   BOOLEAN       DEFAULT TRUE
      );
    `);

    // Garante colunas neutras
    await client.query(`ALTER TABLE public.${TB} ADD COLUMN IF NOT EXISTS ${COLS.unit_id}     INTEGER NULL;`);
    await client.query(`ALTER TABLE public.${TB} ADD COLUMN IF NOT EXISTS ${COLS.description} VARCHAR(100);`);
    await client.query(`ALTER TABLE public.${TB} ADD COLUMN IF NOT EXISTS ${COLS.barcode}     VARCHAR(50);`);
    await client.query(`ALTER TABLE public.${TB} ADD COLUMN IF NOT EXISTS ${COLS.standard}   BOOLEAN DEFAULT FALSE;`);
    await client.query(`ALTER TABLE public.${TB} ADD COLUMN IF NOT EXISTS ${COLS.created_at} TIMESTAMP DEFAULT NOW();`);
    await client.query(`ALTER TABLE public.${TB} ADD COLUMN IF NOT EXISTS ${COLS.updated_at} TIMESTAMP DEFAULT NOW();`);
    await client.query(`ALTER TABLE public.${TB} ADD COLUMN IF NOT EXISTS ${COLS.is_active}  BOOLEAN DEFAULT TRUE;`);
    await client.query(`ALTER TABLE public.${TB} ADD COLUMN IF NOT EXISTS ${COLS.fator}      NUMERIC(10,3) DEFAULT 1;`);

    // ✅ Compat: se existir product_id mas não existir product_code, cria product_code e tenta popular
    await client.query(`ALTER TABLE public.${TB} ADD COLUMN IF NOT EXISTS product_code VARCHAR(50) NULL;`);
    await client.query(`ALTER TABLE public.${TB} ADD COLUMN IF NOT EXISTS product_id   VARCHAR(50) NULL;`);

    // Se product_code estiver NULL e product_id tiver valor, copia (não quebra legado)
    await client.query(`
      UPDATE public.${TB}
         SET product_code = COALESCE(product_code, product_id)
       WHERE product_code IS NULL
         AND product_id IS NOT NULL;
    `);

    // normalize unit
    await client.query(`
      UPDATE public.${TB}
         SET ${COLS.unit} = UPPER(BTRIM(${COLS.unit}))
       WHERE ${COLS.unit} IS NOT NULL
         AND ${COLS.unit} <> UPPER(BTRIM(${COLS.unit}));
    `);

    // normalize barcode legado (se existir)
    await client.query(`
      UPDATE public.${TB}
         SET ${COLS.barcode} = NULLIF(regexp_replace(COALESCE(${COLS.barcode}, ''), '\\D+', '', 'g'), '')
       WHERE ${COLS.barcode} IS NOT NULL;
    `);

    // trigger updated_at
    await client.query(`
      CREATE OR REPLACE FUNCTION public.productsunits_set_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.${COLS.updated_at} = NOW();
        RETURN NEW;
      END; $$ LANGUAGE plpgsql;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'productsunits_set_updated_at_trg') THEN
          CREATE TRIGGER productsunits_set_updated_at_trg
          BEFORE UPDATE ON public.${TB}
          FOR EACH ROW
          EXECUTE PROCEDURE public.productsunits_set_updated_at();
        END IF;
      END $$;
    `);

    // trigger normalize unit/barcode
    await client.query(`
      CREATE OR REPLACE FUNCTION public.productsunits_normalize()
      RETURNS trigger AS $$
      BEGIN
        IF NEW.${COLS.unit} IS NOT NULL THEN
          NEW.${COLS.unit} := UPPER(BTRIM(NEW.${COLS.unit}));
        END IF;

        IF NEW.${COLS.barcode} IS NOT NULL THEN
          NEW.${COLS.barcode} := NULLIF(regexp_replace(NEW.${COLS.barcode}, '\\D+', '', 'g'), '');
        END IF;

        RETURN NEW;
      END; $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS productsunits_normalize_trg ON public.${TB};
      CREATE TRIGGER productsunits_normalize_trg
      BEFORE INSERT OR UPDATE ON public.${TB}
      FOR EACH ROW
      EXECUTE PROCEDURE public.productsunits_normalize();
    `);

    await client.query('COMMIT');

    // reset caches
    resetSchemaCache();

    await checkBarcodeColumn();
    await checkPbcColumns();
    await checkProductsUnitsProductColumn();

    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
