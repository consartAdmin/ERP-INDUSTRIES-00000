// ╔════════════════════════════════════════════════════════════════════╗
// ║ priceCommissions.schema.js — DDL de public."priceCommissions"      ║
// ║ PK real = commission_id; migra price_commission_id se existir      ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB_PRICES, TB_SELLERS, TB_PC } from './priceCommissions.constants.js';

// ======================================================================
// DDL (idempotente + compatível com banco já existente)
// - Garante coluna commission_id como BIGSERIAL
// - Se existir price_commission_id, migra (rename) -> commission_id
// - Garante PK em commission_id
// - Índices e unique
// - Trigger updated_at
// ======================================================================
export const DDL = `
  CREATE TABLE IF NOT EXISTS ${TB_PC} (
    commission_id BIGSERIAL PRIMARY KEY,

    price_id  INTEGER NOT NULL
      REFERENCES ${TB_PRICES}(price_id)
      ON UPDATE CASCADE
      ON DELETE RESTRICT,

    seller_id INTEGER NOT NULL
      REFERENCES ${TB_SELLERS}(id)
      ON UPDATE CASCADE
      ON DELETE RESTRICT,

    commission_type VARCHAR(20) NOT NULL DEFAULT 'PERCENT', -- PERCENT | FIXED
    percent_value   NUMERIC(10,4) NOT NULL DEFAULT 0,
    fixed_value     NUMERIC(14,2) NOT NULL DEFAULT 0,

    active     BOOLEAN NOT NULL DEFAULT TRUE,
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to   DATE NULL,

    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  DO $$
  BEGIN
    -- Se a tabela já existia com a PK antiga, renomeia de forma segura
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='priceCommissions' AND column_name='price_commission_id'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='priceCommissions' AND column_name='commission_id'
    )
    THEN
      EXECUTE 'ALTER TABLE ${TB_PC} RENAME COLUMN price_commission_id TO commission_id';
    END IF;

    -- Se não existe commission_id por algum motivo, cria
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='priceCommissions' AND column_name='commission_id'
    )
    THEN
      EXECUTE 'ALTER TABLE ${TB_PC} ADD COLUMN commission_id BIGSERIAL';
    END IF;

    -- Garante PK em commission_id (se a PK não for essa)
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE c.contype = 'p'
        AND n.nspname = 'public'
        AND t.relname = 'priceCommissions'
        AND pg_get_constraintdef(c.oid) ILIKE '%(commission_id)%'
    )
    THEN
      -- remove PK anterior, se houver
      IF EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE c.contype = 'p'
          AND n.nspname = 'public'
          AND t.relname = 'priceCommissions'
      )
      THEN
        EXECUTE (
          SELECT 'ALTER TABLE ${TB_PC} DROP CONSTRAINT ' || quote_ident(c.conname)
          FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          JOIN pg_namespace n ON n.oid = t.relnamespace
          WHERE c.contype = 'p'
            AND n.nspname = 'public'
            AND t.relname = 'priceCommissions'
          LIMIT 1
        );
      END IF;

      EXECUTE 'ALTER TABLE ${TB_PC} ADD PRIMARY KEY (commission_id)';
    END IF;
  END$$;

  CREATE INDEX IF NOT EXISTS idx_priceCommissions_price
    ON ${TB_PC}(price_id);

  CREATE INDEX IF NOT EXISTS idx_priceCommissions_seller
    ON ${TB_PC}(seller_id);

  CREATE INDEX IF NOT EXISTS idx_priceCommissions_active
    ON ${TB_PC}(active);

  CREATE INDEX IF NOT EXISTS idx_priceCommissions_vigencia
    ON ${TB_PC}(valid_from, valid_to);

  CREATE UNIQUE INDEX IF NOT EXISTS uq_priceCommissions_unique
    ON ${TB_PC}(price_id, seller_id, valid_from);

  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_timestamp_price_commissions') THEN
      CREATE OR REPLACE FUNCTION set_timestamp_price_commissions()
      RETURNS TRIGGER AS $f$
      BEGIN
        NEW.updated_at := CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $f$ LANGUAGE plpgsql;
    END IF;
  END$$;

  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_price_commissions_set_timestamp') THEN
      CREATE TRIGGER trg_price_commissions_set_timestamp
      BEFORE UPDATE ON ${TB_PC}
      FOR EACH ROW
      EXECUTE FUNCTION set_timestamp_price_commissions();
    END IF;
  END$$;
`;
