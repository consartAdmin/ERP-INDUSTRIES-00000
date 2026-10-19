// ╔════════════════════════════════════════════════════════════════════╗
// ║ fixedExpensesSchema.repository.js — ensureTable (idempotente)      ║
// ║ Tabela: "fixedExpenses" (customer_id UUID, payload JSONB)          ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TABLE } from './fixedExpenses.constants.js';
import { q } from './fixedExpenses.sql.js';

/**
 * ensureTable (idempotente)
 * - Só cria se NÃO existir
 * - Cria com customer_id UUID, payload JSONB NOT NULL default '{}'
 * - Cria UNIQUE(customer_id, report_name) (modelo correto multi-customer)
 * - NÃO cria UNIQUE(report_name) (isso quebra multi-customer)
 */
export async function ensureTable() {
  const ddl = `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'fixedExpenses'
      ) THEN
        CREATE TABLE ${TABLE} (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          customer_id UUID,
          report_name TEXT NOT NULL,
          payload JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT uq_fixedexpenses_customer_report UNIQUE (customer_id, report_name)
        );
      END IF;
    END$$;

    -- Função updated_at (idempotente)
    CREATE OR REPLACE FUNCTION fixedexpenses_set_updated_at()
    RETURNS TRIGGER AS $f$
    BEGIN
      NEW.updated_at := NOW();
      RETURN NEW;
    END;
    $f$ LANGUAGE plpgsql;

    -- Trigger updated_at (idempotente)
    DO $$
    DECLARE
      tbl_oid oid := to_regclass('public."fixedExpenses"');
    BEGIN
      IF tbl_oid IS NOT NULL THEN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger t
           WHERE t.tgname = 'tr_fixedexpenses_set_updated_at'
             AND t.tgrelid = tbl_oid
        ) THEN
          CREATE TRIGGER tr_fixedexpenses_set_updated_at
          BEFORE UPDATE ON "fixedExpenses"
          FOR EACH ROW EXECUTE FUNCTION fixedexpenses_set_updated_at();
        END IF;
      END IF;
    END$$;

    -- Índices úteis
    CREATE INDEX IF NOT EXISTS idx_fixedexpenses_created_at  ON ${TABLE}(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_fixedexpenses_customer_id ON ${TABLE}(customer_id);
    CREATE INDEX IF NOT EXISTS idx_fixedexpenses_report_name ON ${TABLE}(report_name);
    CREATE INDEX IF NOT EXISTS idx_fixedexpenses_payload_gin ON ${TABLE} USING GIN (payload);
  `;
  await q(ddl);
  return { ok: true };
}
