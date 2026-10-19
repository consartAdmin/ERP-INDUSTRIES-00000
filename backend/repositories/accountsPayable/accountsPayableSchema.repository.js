// ╔════════════════════════════════════════════════════════════════════╗
// ║ accountsPayableSchema.repository.js — ensureTable (bootstrap)      ║
// ║ Anexos + FKs de categoria/subcategoria para o Caixa                ║
// ╚════════════════════════════════════════════════════════════════════╝

import { SCHEMA, TB_FULL, TB_ATTACH } from './accountsPayable.constants.js';
import { q } from './accountsPayable.utils.js';

export async function ensureTable() {
  await q('SELECT 1');

  await q(`
    CREATE TABLE IF NOT EXISTS ${TB_ATTACH} (
      id bigserial PRIMARY KEY,
      account_payable_id integer NOT NULL
        REFERENCES ${TB_FULL}(id)
        ON DELETE CASCADE,
      file_type varchar(20) NOT NULL,
      file_name text,
      file_url text,
      mime_type text,
      file_size bigint NOT NULL DEFAULT 0,
      gcs_bucket text,
      gcs_path text,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await q(`
    ALTER TABLE ${TB_ATTACH}
      ADD COLUMN IF NOT EXISTS mime_type text,
      ADD COLUMN IF NOT EXISTS file_size bigint NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS gcs_bucket text,
      ADD COLUMN IF NOT EXISTS gcs_path text,
      ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
  `);

  await q(`ALTER TABLE ${TB_ATTACH} ALTER COLUMN file_url DROP NOT NULL`);

  // Categoria/subcategoria agora vêm do Caixa ("cashCategories"/"cashSubcategories").
  // As FKs antigas apontavam para "expensesCategories"/"expensesSubcategories" (legado, vazias).
  await q(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'accountsPayable_category_id_fkey'
          AND confrelid IS DISTINCT FROM to_regclass('${SCHEMA}."cashCategories"')
      ) THEN
        ALTER TABLE ${TB_FULL} DROP CONSTRAINT "accountsPayable_category_id_fkey";
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'accountsPayable_category_id_fkey'
      ) THEN
        ALTER TABLE ${TB_FULL}
          ADD CONSTRAINT "accountsPayable_category_id_fkey"
          FOREIGN KEY (category_id) REFERENCES ${SCHEMA}."cashCategories"(id)
          ON UPDATE CASCADE ON DELETE SET NULL;
      END IF;

      IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'accountsPayable_subcategory_id_fkey'
          AND confrelid IS DISTINCT FROM to_regclass('${SCHEMA}."cashSubcategories"')
      ) THEN
        ALTER TABLE ${TB_FULL} DROP CONSTRAINT "accountsPayable_subcategory_id_fkey";
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'accountsPayable_subcategory_id_fkey'
      ) THEN
        ALTER TABLE ${TB_FULL}
          ADD CONSTRAINT "accountsPayable_subcategory_id_fkey"
          FOREIGN KEY (subcategory_id) REFERENCES ${SCHEMA}."cashSubcategories"(id)
          ON UPDATE CASCADE ON DELETE SET NULL;
      END IF;
    END $$;
  `);

  await q(`
    CREATE INDEX IF NOT EXISTS idx_accounts_payable_attachments_account
      ON ${TB_ATTACH}(account_payable_id)
  `);

  await q(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_accounts_payable_attachments_unique
      ON ${TB_ATTACH}(account_payable_id, file_type, file_url)
  `);

  await q(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_accounts_payable_attachments_gcs_object
      ON ${TB_ATTACH}(gcs_bucket, gcs_path)
      WHERE gcs_bucket IS NOT NULL AND gcs_path IS NOT NULL
  `);
}
