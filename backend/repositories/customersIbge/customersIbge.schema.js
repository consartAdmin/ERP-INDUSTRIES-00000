// ╔════════════════════════════════════════════════════════════════════╗
// ║ customersIbge.schema.js — DDL de public."customersIbge"            ║
// ║ Idempotente (tabela, colunas, defaults, índices, trigger).         ║
// ║ Depende de: public.customers (FK)                                  ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB_CUSTOMERS, TB_CUSTOMERS_IBGE } from './customersIbge.constants.js';

// ----------------------------------------------------------------------
// DDL / Infra
// ----------------------------------------------------------------------
export const DDL = {
  customersIbge: `
    CREATE TABLE IF NOT EXISTS ${TB_CUSTOMERS_IBGE} (
      customer_id  BIGINT  NOT NULL PRIMARY KEY
        REFERENCES ${TB_CUSTOMERS}(customer_id) ON DELETE CASCADE,

      uf           CHAR(2) NOT NULL,
      city         TEXT    NOT NULL,

      codigo_ibge  CHAR(7),

      source       TEXT     NOT NULL DEFAULT 'manual',
      confidence   SMALLINT NOT NULL DEFAULT 100,

      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- ✅ Compat / evolução: garante colunas em bancos já existentes
    ALTER TABLE ${TB_CUSTOMERS_IBGE}
      ADD COLUMN IF NOT EXISTS uf          CHAR(2),
      ADD COLUMN IF NOT EXISTS city        TEXT,
      ADD COLUMN IF NOT EXISTS codigo_ibge CHAR(7),
      ADD COLUMN IF NOT EXISTS source      TEXT,
      ADD COLUMN IF NOT EXISTS confidence  SMALLINT,
      ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ;

    -- ✅ Defaults e NOT NULL (sem quebrar dados existentes)
    -- (Obs: NOT NULL só é seguro se não houver linhas com NULL; por isso usamos COALESCE via UPDATE)
    UPDATE ${TB_CUSTOMERS_IBGE}
      SET
        source     = COALESCE(source, 'manual'),
        confidence = COALESCE(confidence, 100),
        created_at = COALESCE(created_at, NOW()),
        updated_at = COALESCE(updated_at, NOW())
    WHERE
      source IS NULL OR confidence IS NULL OR created_at IS NULL OR updated_at IS NULL;

    -- garante defaults
    ALTER TABLE ${TB_CUSTOMERS_IBGE}
      ALTER COLUMN source     SET DEFAULT 'manual',
      ALTER COLUMN confidence SET DEFAULT 100,
      ALTER COLUMN created_at SET DEFAULT NOW(),
      ALTER COLUMN updated_at SET DEFAULT NOW();

    -- se uf/city estiverem NULL em tabela antiga, tenta manter consistência (não força NOT NULL aqui)
    -- Você pode reforçar NOT NULL depois de limpar dados, se quiser.

    -- garante índice de busca por UF/cidade
    CREATE INDEX IF NOT EXISTS idx_customersibge_uf_city
      ON ${TB_CUSTOMERS_IBGE}(uf, city);

    -- (opcional, mas ajuda muito em resolução por código)
    CREATE INDEX IF NOT EXISTS idx_customersibge_codigo_ibge
      ON ${TB_CUSTOMERS_IBGE}(codigo_ibge);

    -- trigger updated_at
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at_customers_ibge'
      ) THEN
        CREATE OR REPLACE FUNCTION set_updated_at_customers_ibge()
        RETURNS TRIGGER AS $f$
        BEGIN
          NEW.updated_at := NOW();
          RETURN NEW;
        END;
        $f$ LANGUAGE plpgsql;
      END IF;
    END$$;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_customersibge_updated_at'
      ) THEN
        CREATE TRIGGER trg_customersibge_updated_at
        BEFORE UPDATE ON ${TB_CUSTOMERS_IBGE}
        FOR EACH ROW EXECUTE FUNCTION set_updated_at_customers_ibge();
      END IF;
    END$$;
  `,
};
