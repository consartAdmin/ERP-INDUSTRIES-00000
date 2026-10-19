// ╔════════════════════════════════════════════════════════════════════╗
// ║ counterPanelCustomers.schema.js — DDL (tabela, trigger, índices)   ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB } from './counterPanelCustomers.constants.js';

// ----------------------------------------------------------------------
// DDL / Infra
// ----------------------------------------------------------------------
export const DDL = `
  CREATE TABLE IF NOT EXISTS ${TB} (
    id               BIGSERIAL PRIMARY KEY,

    customer_id      BIGINT NOT NULL,
    customer_name    VARCHAR(255),

    doc_type         VARCHAR(50)  NOT NULL,
    title            VARCHAR(255) NOT NULL,
    description      TEXT,

    competence_month INTEGER CHECK (competence_month BETWEEN 1 AND 12),
    competence_year  INTEGER CHECK (competence_year BETWEEN 2000 AND 2100),

    file_name        VARCHAR(255) NOT NULL,
    file_url         TEXT,
    mime_type        VARCHAR(120),
    file_size_bytes  BIGINT CHECK (file_size_bytes >= 0),

    status           VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
    is_viewed        BOOLEAN NOT NULL DEFAULT FALSE,
    viewed_at        TIMESTAMP,

    created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
  );

  -- ✅ Evolução compatível (GCS)
  ALTER TABLE ${TB} ADD COLUMN IF NOT EXISTS storage_driver VARCHAR(20);
  ALTER TABLE ${TB} ADD COLUMN IF NOT EXISTS gcs_bucket     VARCHAR(255);
  ALTER TABLE ${TB} ADD COLUMN IF NOT EXISTS gcs_key        TEXT;

  -- ✅ UX Status visual (Baixado)
  ALTER TABLE ${TB} ADD COLUMN IF NOT EXISTS is_downloaded  BOOLEAN NOT NULL DEFAULT FALSE;
  ALTER TABLE ${TB} ADD COLUMN IF NOT EXISTS downloaded_at  TIMESTAMP;

  -- Trigger updated_at (padrão CONSART)
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at_counter_panel_customers'
    ) THEN
      CREATE OR REPLACE FUNCTION set_updated_at_counter_panel_customers()
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
      SELECT 1 FROM pg_trigger WHERE tgname = 'trg_counter_panel_customers_updated_at'
    ) THEN
      CREATE TRIGGER trg_counter_panel_customers_updated_at
      BEFORE UPDATE ON ${TB}
      FOR EACH ROW EXECUTE FUNCTION set_updated_at_counter_panel_customers();
    END IF;
  END$$;

  -- Índices
  CREATE INDEX IF NOT EXISTS idx_cpc_customer       ON ${TB}(customer_id);
  CREATE INDEX IF NOT EXISTS idx_cpc_doc_type       ON ${TB}(doc_type);
  CREATE INDEX IF NOT EXISTS idx_cpc_competence     ON ${TB}(competence_year, competence_month);
  CREATE INDEX IF NOT EXISTS idx_cpc_created_at     ON ${TB}(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_cpc_status         ON ${TB}(status);
  CREATE INDEX IF NOT EXISTS idx_cpc_title_lc       ON ${TB}((LOWER(title)));

  -- (GCS)
  CREATE INDEX IF NOT EXISTS idx_cpc_gcs_key        ON ${TB}((COALESCE(gcs_key,'')));

  -- (Download)
  CREATE INDEX IF NOT EXISTS idx_cpc_is_downloaded  ON ${TB}(is_downloaded);

  -- Opcional: evita duplicar mesmo arquivo pro mesmo cliente no mesmo período/tipo
  CREATE UNIQUE INDEX IF NOT EXISTS uq_cpc_unique_doc
    ON ${TB}(customer_id, doc_type, competence_year, competence_month, file_name);
`;
