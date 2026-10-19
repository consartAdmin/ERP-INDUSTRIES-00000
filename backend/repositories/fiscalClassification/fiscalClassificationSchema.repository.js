// ╔════════════════════════════════════════════════════════════════════╗
// ║ fiscalClassificationSchema.repository.js — ensureTable             ║
// ║ DDL idempotente de fiscalProfile + fiscalClassification            ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_PROFILE, TB } from './fiscalClassification.constants.js';

/* ──────────────────────────────────────────────────────────────
   DDL — garante estrutura idempotente
────────────────────────────────────────────────────────────── */
export async function ensureTable() {
  const client = await pool.connect();
  try {
    console.log('🧪 ensureTable() — fiscalProfile & fiscalClassification');
    await client.query('BEGIN');

    // 1) Tabela de Perfil Fiscal (mestre)
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${TB_PROFILE} (
        fiscal_profile_id  SERIAL PRIMARY KEY,
        profile_name       TEXT NOT NULL,
        description        TEXT,
        is_active          BOOLEAN DEFAULT TRUE,
        created_at         TIMESTAMP DEFAULT NOW(),
        updated_at         TIMESTAMP DEFAULT NOW()
      );
    `);

    // Índice único case-insensitive no nome do perfil
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE schemaname = 'public'
            AND indexname = 'idx_fiscalprofile_profile_name_unique'
        ) THEN
          CREATE UNIQUE INDEX idx_fiscalprofile_profile_name_unique
            ON ${TB_PROFILE} (LOWER(profile_name));
        END IF;
      END$$;
    `);

    // 2) Tabela de Classificação Fiscal (detalhe) — colunas conforme seu schema
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${TB} (
        fiscal_classification_id  SERIAL PRIMARY KEY,

        -- 🏷️ Descritivo
        classification_name       VARCHAR(150) NOT NULL,
        description               TEXT,

        -- 🧮 Códigos fiscais
        ncm_code                  VARCHAR(10),
        cest_code                 VARCHAR(10),

        -- 📜 Descrições
        ncm_description           TEXT,
        cest_description          TEXT,

        -- ⚙️ Perfil fiscal vinculado
        fiscal_profile_id         INTEGER REFERENCES ${TB_PROFILE}(fiscal_profile_id) ON UPDATE CASCADE ON DELETE SET NULL,

        -- ⚖️ Status e Auditoria
        is_active                 BOOLEAN DEFAULT TRUE,
        created_at                TIMESTAMP DEFAULT NOW(),
        updated_at                TIMESTAMP DEFAULT NOW()
      );
    `);

    // Índices conforme seu schema
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE schemaname = 'public'
            AND indexname = 'idx_fiscalclassification_ncm'
        ) THEN
          CREATE INDEX idx_fiscalclassification_ncm ON ${TB} (ncm_code);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE schemaname = 'public'
            AND indexname = 'idx_fiscalclassification_cest'
        ) THEN
          CREATE INDEX idx_fiscalclassification_cest ON ${TB} (cest_code);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE schemaname = 'public'
            AND indexname = 'idx_fiscalclassification_name_ci'
        ) THEN
          CREATE INDEX idx_fiscalclassification_name_ci ON ${TB} (LOWER(classification_name));
        END IF;
      END$$;
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
