// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsFiscalSchema.repository.js — ensureTable                   ║
// ║ DDL idempotente + sequence/OWNED BY/DEFAULT da PK                  ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { PK_SEQ } from './productsFiscal.constants.js';

/* ──────────────────────────────────────────────────────────
   DDL / Migração idempotente (ALINHADA À TABELA REAL)
   ✅ garante SEQUENCE + OWNED BY + DEFAULT do products_fiscal_id
────────────────────────────────────────────────────────── */
export async function ensureTable() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // cria tabela base (se não existir)
    await client.query(`
      CREATE TABLE IF NOT EXISTS public."productsFiscal" (
        products_fiscal_id INTEGER
      );
    `);

    // garante coluna PK existe
    await client.query(`
      ALTER TABLE public."productsFiscal"
        ADD COLUMN IF NOT EXISTS products_fiscal_id INTEGER;
    `);

    // garante NOT NULL da PK
    await client.query(`
      ALTER TABLE public."productsFiscal"
        ALTER COLUMN products_fiscal_id SET NOT NULL;
    `);

    // garante PK (se não existir)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conrelid = 'public."productsFiscal"'::regclass
            AND contype = 'p'
        ) THEN
          ALTER TABLE public."productsFiscal"
            ADD CONSTRAINT "productsFiscal_pkey" PRIMARY KEY (products_fiscal_id);
        END IF;
      END $$;
    `);

    // ✅ garante sequence + owned by + default + setval
    await client.query(`
      DO $$
      DECLARE
        seq_name TEXT := '${PK_SEQ}';
        has_def  BOOLEAN;
      BEGIN
        -- 1) cria sequence se não existir
        IF NOT EXISTS (
          SELECT 1 FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relkind = 'S' AND n.nspname = 'public' AND c.relname = seq_name
        ) THEN
          EXECUTE format('CREATE SEQUENCE public.%I', seq_name);
        END IF;

        -- 2) OWNED BY (vincula a coluna na sequence)
        EXECUTE format(
          'ALTER SEQUENCE public.%I OWNED BY public."productsFiscal".products_fiscal_id',
          seq_name
        );

        -- 3) verifica se a coluna tem default
        SELECT EXISTS (
          SELECT 1
          FROM pg_attrdef d
          JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
          WHERE d.adrelid = 'public."productsFiscal"'::regclass
            AND a.attname = 'products_fiscal_id'
        ) INTO has_def;

        -- 4) se não tem default, seta
        IF NOT has_def THEN
          EXECUTE format(
            'ALTER TABLE public."productsFiscal" ALTER COLUMN products_fiscal_id SET DEFAULT nextval(''public.%I''::regclass)',
            seq_name
          );
        END IF;

        -- 5) sincroniza para evitar colisão
        EXECUTE format(
          'SELECT setval(''public.%I'', COALESCE((SELECT MAX(products_fiscal_id) FROM public."productsFiscal"), 0) + 1, false)',
          seq_name
        );
      END $$;
    `);

    // coluna chave (SEM FK)
    await client.query(`
      ALTER TABLE public."productsFiscal"
        ADD COLUMN IF NOT EXISTS product_code VARCHAR(60);
    `);

    // colunas (tipos conforme DESCRIBE)
    await client.query(`
      ALTER TABLE public."productsFiscal"
        ADD COLUMN IF NOT EXISTS fiscal_classification_id INTEGER,
        ADD COLUMN IF NOT EXISTS fiscal_profile_id INTEGER,

        ADD COLUMN IF NOT EXISTS classification_name VARCHAR(150),
        ADD COLUMN IF NOT EXISTS description_class TEXT,
        ADD COLUMN IF NOT EXISTS ncm_code VARCHAR(10),
        ADD COLUMN IF NOT EXISTS ncm_description TEXT,
        ADD COLUMN IF NOT EXISTS cest_code VARCHAR(10),
        ADD COLUMN IF NOT EXISTS cest_description TEXT,

        ADD COLUMN IF NOT EXISTS profile_name VARCHAR(120),
        ADD COLUMN IF NOT EXISTS description_profile TEXT,

        ADD COLUMN IF NOT EXISTS icms_cst VARCHAR(10),
        ADD COLUMN IF NOT EXISTS icms_rate NUMERIC(6,2),
        ADD COLUMN IF NOT EXISTS cfop_entry VARCHAR(10),
        ADD COLUMN IF NOT EXISTS cfop_exit VARCHAR(10),
        ADD COLUMN IF NOT EXISTS origin_code VARCHAR(10),

        ADD COLUMN IF NOT EXISTS pis_cst VARCHAR(10),
        ADD COLUMN IF NOT EXISTS pis_rate NUMERIC(6,2),
        ADD COLUMN IF NOT EXISTS cofins_cst VARCHAR(10),
        ADD COLUMN IF NOT EXISTS cofins_rate NUMERIC(6,2),

        ADD COLUMN IF NOT EXISTS benefit_code VARCHAR(20),

        ADD COLUMN IF NOT EXISTS effective_from TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS effective_to   TIMESTAMP WITHOUT TIME ZONE,
        ADD COLUMN IF NOT EXISTS version        INTEGER DEFAULT 1,
        ADD COLUMN IF NOT EXISTS is_active      BOOLEAN DEFAULT TRUE,

        ADD COLUMN IF NOT EXISTS source_system    VARCHAR(60),
        ADD COLUMN IF NOT EXISTS source_reference VARCHAR(120),
        ADD COLUMN IF NOT EXISTS source_hash      TEXT,
        ADD COLUMN IF NOT EXISTS extra_payload    JSONB,
        ADD COLUMN IF NOT EXISTS raw_payload      JSONB,

        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),

        -- espelhos/canônicos
        ADD COLUMN IF NOT EXISTS ncm VARCHAR(12),
        ADD COLUMN IF NOT EXISTS ex_tipi VARCHAR(3),
        ADD COLUMN IF NOT EXISTS cest VARCHAR(10),
        ADD COLUMN IF NOT EXISTS origem_mercadoria SMALLINT,
        ADD COLUMN IF NOT EXISTS cst_icms VARCHAR(3),
        ADD COLUMN IF NOT EXISTS csosn VARCHAR(3),
        ADD COLUMN IF NOT EXISTS modalidade_bc VARCHAR(2),
        ADD COLUMN IF NOT EXISTS modalidade_bc_st VARCHAR(2),
        ADD COLUMN IF NOT EXISTS aliquota_icms NUMERIC(7,4),
        ADD COLUMN IF NOT EXISTS reducao_bc NUMERIC(7,4),
        ADD COLUMN IF NOT EXISTS mva_st NUMERIC(7,4),
        ADD COLUMN IF NOT EXISTS aliquota_st NUMERIC(7,4),
        ADD COLUMN IF NOT EXISTS aliquota_fcp NUMERIC(7,4),
        ADD COLUMN IF NOT EXISTS cfops_entrada TEXT[],
        ADD COLUMN IF NOT EXISTS cfops_saida   TEXT[],
        ADD COLUMN IF NOT EXISTS pis_aliquota NUMERIC(7,4),
        ADD COLUMN IF NOT EXISTS cofins_aliquota NUMERIC(7,4),
        ADD COLUMN IF NOT EXISTS ipi_cst VARCHAR(3),
        ADD COLUMN IF NOT EXISTS ipi_aliquota NUMERIC(7,4),
        ADD COLUMN IF NOT EXISTS ibpt_nacional NUMERIC(7,4),
        ADD COLUMN IF NOT EXISTS ibpt_importado NUMERIC(7,4),
        ADD COLUMN IF NOT EXISTS ibpt_estadual NUMERIC(7,4),
        ADD COLUMN IF NOT EXISTS ibpt_municipal NUMERIC(7,4),
        ADD COLUMN IF NOT EXISTS observacao TEXT,

        -- snapshot versioning (com TZ)
        ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS valid_to   TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS is_current BOOLEAN;
    `);

    // FKs (idempotente via DO $$)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'productsfiscal_fiscal_classification_id_fkey'
        ) THEN
          ALTER TABLE public."productsFiscal"
            ADD CONSTRAINT productsfiscal_fiscal_classification_id_fkey
            FOREIGN KEY (fiscal_classification_id)
            REFERENCES public."fiscalClassification"(fiscal_classification_id)
            ON UPDATE CASCADE ON DELETE SET NULL;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'productsfiscal_fiscal_profile_id_fkey'
        ) THEN
          ALTER TABLE public."productsFiscal"
            ADD CONSTRAINT productsfiscal_fiscal_profile_id_fkey
            FOREIGN KEY (fiscal_profile_id)
            REFERENCES public."fiscalProfile"(fiscal_profile_id)
            ON UPDATE CASCADE ON DELETE SET NULL;
        END IF;
      END$$;
    `);

    // índices (idempotente)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_productsfiscal_ncm ON public."productsFiscal"(ncm_code);
      CREATE INDEX IF NOT EXISTS idx_productsfiscal_cest ON public."productsFiscal"(cest_code);
      CREATE INDEX IF NOT EXISTS idx_productsfiscal_is_current ON public."productsFiscal"(is_current);
      CREATE INDEX IF NOT EXISTS idx_productsfiscal_product_code ON public."productsFiscal"(product_code);
    `);

    // unique (source_system, source_hash)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'ux_productsfiscal_source_hash'
        ) THEN
          ALTER TABLE public."productsFiscal"
            ADD CONSTRAINT ux_productsfiscal_source_hash
            UNIQUE (source_system, source_hash);
        END IF;
      END$$;
    `);

    // opcional (recomendado): evitar 2 snapshots "current" pro mesmo produto
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_productsfiscal_current_per_product
      ON public."productsFiscal"(product_code)
      WHERE is_current = TRUE AND is_active = TRUE;
    `);

    await client.query('COMMIT');
    return { ok: true, table: 'productsFiscal', message: 'ensureTable() aligned + seq/default enforced' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
