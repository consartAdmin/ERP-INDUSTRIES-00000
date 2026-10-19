// ╔════════════════════════════════════════════════════════════════════╗
// ║ accountsReceivable.schema.js — DDL da tabela ponte Asaas           ║
// ║ Executa o DDL ao importar (mesmo efeito do arquivo original)       ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, TB_BRIDGE } from './accountsReceivable.constants.js';

// -------------------------------------------------------------------
// DDL da tabela ponte
// -------------------------------------------------------------------
export const DDL = `
CREATE TABLE IF NOT EXISTS ${TB_BRIDGE} (
  id                      BIGSERIAL PRIMARY KEY,
  accounts_receivable_id  BIGINT REFERENCES ${TB}(id) ON DELETE CASCADE,
  asaas_payment_id        VARCHAR(80) UNIQUE NOT NULL,
  asaas_customer_id       VARCHAR(80),
  asaas_customer_name     TEXT,
  last_status             TEXT,
  raw                     JSONB,
  created_at              TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  updated_at              TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

CREATE OR REPLACE FUNCTION trg_accounts_receivable_asaas_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_accounts_receivable_asaas_set_updated_at'
  ) THEN
    CREATE TRIGGER trg_accounts_receivable_asaas_set_updated_at
    BEFORE UPDATE ON ${TB_BRIDGE}
    FOR EACH ROW
    EXECUTE PROCEDURE trg_accounts_receivable_asaas_set_updated_at();
  END IF;
END;
$$;
`;

pool.query(DDL).catch((err) => {
  console.error('[AR][DDL] Erro ao criar tabela ponte Asaas:', err.message);
});
