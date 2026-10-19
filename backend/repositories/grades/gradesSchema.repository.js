// ╔════════════════════════════════════════════════════════════════════╗
// ║ gradesSchema.repository.js — ensureTable (singleton, idempotente)  ║
// ║ Tabela: public."grades" (+ índices, trigger, sequence)             ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TFULL, ALIAS, nowSql } from './grades.constants.js';

/* ──────────────────────────────────────────────────────────────
   ensureTable singleton (evita rodar em toda request)
────────────────────────────────────────────────────────────── */
let _ensurePromise = null;

/* ──────────────────────────────────────────────────────────────
   ensureTable() — Cria tabela e estrutura de suporte (idempotente)
────────────────────────────────────────────────────────────── */
export async function ensureTable() {
  if (_ensurePromise) return _ensurePromise;

  _ensurePromise = (async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Tabela base
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${TFULL} (
          grade_id SERIAL PRIMARY KEY,
          grade VARCHAR(50) NOT NULL UNIQUE,
          description TEXT,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT ${nowSql},
          updated_at TIMESTAMP DEFAULT ${nowSql},
          version INTEGER DEFAULT 1,
          source_system VARCHAR(50),
          source_hash VARCHAR(120)
        );
      `);

      // Índice único case-insensitive (opcional, mas útil se alguém tentar inserir sem normalizar)
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_indexes WHERE indexname = 'idx_grades_name_unique'
          ) THEN
            CREATE UNIQUE INDEX idx_grades_name_unique
            ON ${TFULL} (LOWER(grade));
          END IF;
        END$$;
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_grades_active ON ${TFULL} (is_active);
        CREATE INDEX IF NOT EXISTS idx_grades_grade  ON ${TFULL} (grade);
      `);

      // Função e trigger para updated_at
      await client.query(`
        CREATE OR REPLACE FUNCTION set_timestamp_grades()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `);

      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_trigger WHERE tgname = 'trg_${ALIAS}_set_timestamp'
          ) THEN
            CREATE TRIGGER trg_${ALIAS}_set_timestamp
            BEFORE UPDATE ON ${TFULL}
            FOR EACH ROW
            EXECUTE FUNCTION set_timestamp_grades();
          END IF;
        END$$;
      `);

      // Sincroniza sequence corretamente
      await client.query(`
        DO $$
        DECLARE
          seq_name text;
          max_id bigint;
        BEGIN
          SELECT pg_get_serial_sequence('${TFULL}', 'grade_id') INTO seq_name;

          IF seq_name IS NOT NULL THEN
            EXECUTE 'SELECT COALESCE(MAX(grade_id), 0) FROM ${TFULL}' INTO max_id;

            IF max_id = 0 THEN
              -- tabela vazia: próximo insert deve gerar 1
              EXECUTE format('SELECT setval(%L, 1, false)', seq_name);
            ELSE
              -- tabela com dados: próximo insert deve gerar max+1
              EXECUTE format('SELECT setval(%L, %s, true)', seq_name, max_id);
            END IF;
          END IF;
        END$$;
      `);

      await client.query('COMMIT');
      return { ok: true };
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('❌ grades.ensureTable() — erro:', e.message);
      _ensurePromise = null; // libera para tentar novamente se falhar
      throw e;
    } finally {
      client.release();
    }
  })();

  return _ensurePromise;
}
