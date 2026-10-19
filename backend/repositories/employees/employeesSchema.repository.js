// ╔══════════════════════════════════════════════════════════════════════╗
// ║ employeesSchema.repository.js — ensureTable (idempotente)            ║
// ║ Tabelas: public.employees, public."employeesDocuments"               ║
// ║ Single-flight + retry + advisory lock                                ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, PK, ALIAS, TB_DOCS, PK_DOCS, DOC_ALIAS } from './employees.constants.js';

// ─────────────────────────────────────────────────────────────
// Deadlock guard: single-flight + retry + advisory lock
// ─────────────────────────────────────────────────────────────
let _ensurePromise = null;

async function withRetry(fn, { tries = 4, baseDelayMs = 200 } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const code = e?.code;
      const retryable = code === '40P01' || code === '55P03' || code === '57014';
      if (!retryable || i === tries - 1) throw e;
      const wait = baseDelayMs * Math.pow(2, i);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

async function advisoryLock(client, keyText) {
  await client.query(`SELECT pg_advisory_lock(hashtext($1)::bigint)`, [keyText]);
}
async function advisoryUnlock(client, keyText) {
  await client.query(`SELECT pg_advisory_unlock(hashtext($1)::bigint)`, [keyText]);
}

async function syncSerialSequence(client, tableName, pkCol) {
  const seqRes = await client.query(`SELECT pg_get_serial_sequence($1, $2) AS seq`, [tableName, pkCol]);
  const seqName = seqRes.rows?.[0]?.seq;
  if (!seqName) return;

  const maxRes = await client.query(`SELECT COALESCE(MAX(${pkCol}), 0)::bigint AS max_id FROM ${tableName}`);
  const maxId = Number(maxRes.rows?.[0]?.max_id || 0);

  if (maxId <= 0) await client.query(`SELECT setval($1, 1, false)`, [seqName]);
  else await client.query(`SELECT setval($1, $2, true)`, [seqName, maxId]);
}

// ─────────────────────────────────────────────────────────────
// ensureTable
// ─────────────────────────────────────────────────────────────
export async function ensureTable() {
  if (_ensurePromise) return _ensurePromise;

  _ensurePromise = withRetry(async () => {
    const client = await pool.connect();
    const LOCK_KEY = 'consart.ensureTable.employees.all';

    try {
      await client.query(`SET lock_timeout TO '5s'`);
      await client.query(`SET statement_timeout TO '25s'`);

      await advisoryLock(client, LOCK_KEY);
      await client.query('BEGIN');

      await client.query(`
        CREATE OR REPLACE FUNCTION set_timestamp()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW()::timestamp;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `);

      // employees
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${TB} (
          employee_id              SERIAL PRIMARY KEY,
          full_name                VARCHAR(150) NOT NULL,
          cpf                      VARCHAR(14)  NOT NULL,
          rg                       VARCHAR(20),
          birth_date               DATE,
          email                    VARCHAR(150),
          phone                    VARCHAR(30),
          mobile                   VARCHAR(30),
          address                  TEXT,
          city                     VARCHAR(100),
          state                    CHAR(2),
          postal_code              VARCHAR(10),
          position                 VARCHAR(100),
          department               VARCHAR(100),
          employment_type          VARCHAR(50),
          salary_base              NUMERIC(12,2),
          admission_date           DATE NOT NULL,
          termination_date         DATE,
          active                   BOOLEAN DEFAULT TRUE,

          trial_start_date         DATE,
          trial_end_date           DATE,
          trial_extended           BOOLEAN DEFAULT FALSE,
          trial_extension_end_date DATE,
          trial_notes              TEXT,

          transport_benefit        NUMERIC(12,2) DEFAULT 0,
          food_benefit             NUMERIC(12,2) DEFAULT 0,
          meal_benefit             NUMERIC(12,2) DEFAULT 0,
          health_benefit           NUMERIC(12,2) DEFAULT 0,

          notes                    TEXT,
          created_at               TIMESTAMP DEFAULT NOW(),
          updated_at               TIMESTAMP DEFAULT NOW()
        );
      `);

      await client.query(`
        ALTER TABLE ${TB}
          ADD COLUMN IF NOT EXISTS rg                       VARCHAR(20),
          ADD COLUMN IF NOT EXISTS birth_date               DATE,
          ADD COLUMN IF NOT EXISTS email                    VARCHAR(150),
          ADD COLUMN IF NOT EXISTS phone                    VARCHAR(30),
          ADD COLUMN IF NOT EXISTS mobile                   VARCHAR(30),
          ADD COLUMN IF NOT EXISTS address                  TEXT,
          ADD COLUMN IF NOT EXISTS city                     VARCHAR(100),
          ADD COLUMN IF NOT EXISTS state                    CHAR(2),
          ADD COLUMN IF NOT EXISTS postal_code              VARCHAR(10),
          ADD COLUMN IF NOT EXISTS position                 VARCHAR(100),
          ADD COLUMN IF NOT EXISTS department               VARCHAR(100),
          ADD COLUMN IF NOT EXISTS employment_type          VARCHAR(50),
          ADD COLUMN IF NOT EXISTS salary_base              NUMERIC(12,2),
          ADD COLUMN IF NOT EXISTS termination_date         DATE,
          ADD COLUMN IF NOT EXISTS active                   BOOLEAN,
          ADD COLUMN IF NOT EXISTS trial_start_date         DATE,
          ADD COLUMN IF NOT EXISTS trial_end_date           DATE,
          ADD COLUMN IF NOT EXISTS trial_extended           BOOLEAN,
          ADD COLUMN IF NOT EXISTS trial_extension_end_date DATE,
          ADD COLUMN IF NOT EXISTS trial_notes              TEXT,
          ADD COLUMN IF NOT EXISTS transport_benefit        NUMERIC(12,2),
          ADD COLUMN IF NOT EXISTS food_benefit             NUMERIC(12,2),
          ADD COLUMN IF NOT EXISTS meal_benefit             NUMERIC(12,2),
          ADD COLUMN IF NOT EXISTS health_benefit           NUMERIC(12,2),
          ADD COLUMN IF NOT EXISTS notes                    TEXT,
          ADD COLUMN IF NOT EXISTS created_at               TIMESTAMP,
          ADD COLUMN IF NOT EXISTS updated_at               TIMESTAMP;
      `);

      await client.query(`
        UPDATE ${TB}
        SET
          active            = COALESCE(active, TRUE),
          trial_extended    = COALESCE(trial_extended, FALSE),
          transport_benefit = COALESCE(transport_benefit, 0),
          food_benefit      = COALESCE(food_benefit, 0),
          meal_benefit      = COALESCE(meal_benefit, 0),
          health_benefit    = COALESCE(health_benefit, 0),
          created_at        = COALESCE(created_at, NOW()::timestamp),
          updated_at        = COALESCE(updated_at, NOW()::timestamp)
        WHERE
          active IS NULL
          OR trial_extended IS NULL
          OR transport_benefit IS NULL
          OR food_benefit IS NULL
          OR meal_benefit IS NULL
          OR health_benefit IS NULL
          OR created_at IS NULL
          OR updated_at IS NULL;
      `);

      await client.query(`
        ALTER TABLE ${TB}
          ALTER COLUMN active            SET DEFAULT TRUE,
          ALTER COLUMN trial_extended    SET DEFAULT FALSE,
          ALTER COLUMN transport_benefit SET DEFAULT 0,
          ALTER COLUMN food_benefit      SET DEFAULT 0,
          ALTER COLUMN meal_benefit      SET DEFAULT 0,
          ALTER COLUMN health_benefit    SET DEFAULT 0,
          ALTER COLUMN created_at        SET DEFAULT NOW(),
          ALTER COLUMN updated_at        SET DEFAULT NOW();
      `);

      await client.query(`
        ALTER TABLE ${TB}
          ALTER COLUMN full_name      SET NOT NULL,
          ALTER COLUMN cpf            SET NOT NULL,
          ALTER COLUMN admission_date SET NOT NULL;
      `);

      await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_cpf_unique
          ON ${TB} (LOWER(cpf::text));
        CREATE INDEX IF NOT EXISTS idx_employees_full_name_lower
          ON ${TB} (LOWER(full_name::text));
      `);

      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_${ALIAS}_set_timestamp') THEN
            CREATE TRIGGER trg_${ALIAS}_set_timestamp
            BEFORE UPDATE ON ${TB}
            FOR EACH ROW
            EXECUTE FUNCTION set_timestamp();
          END IF;
        END $$;
      `);

      // employeesDocuments
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${TB_DOCS} (
          employee_document_id BIGSERIAL PRIMARY KEY,
          employee_id          BIGINT NOT NULL,
          document_type        TEXT NOT NULL,
          file_name            TEXT NOT NULL,
          mime_type            TEXT NOT NULL DEFAULT 'application/octet-stream',
          file_size            BIGINT NOT NULL DEFAULT 0,
          gcs_bucket           TEXT NOT NULL,
          gcs_path             TEXT NOT NULL,
          notes                TEXT,
          created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          is_active            BOOLEAN NOT NULL DEFAULT TRUE,
          updated_at           TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE lower(conname) = lower('employeesDocuments_employee_id_fkey')
          ) THEN
            BEGIN
              ALTER TABLE ${TB_DOCS}
                ADD CONSTRAINT employeesDocuments_employee_id_fkey
                FOREIGN KEY (employee_id) REFERENCES ${TB}(${PK})
                ON UPDATE CASCADE ON DELETE CASCADE;
            EXCEPTION
              WHEN duplicate_object THEN
                NULL;
            END;
          END IF;
        END $$;
      `);

      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_${DOC_ALIAS}_set_timestamp') THEN
            CREATE TRIGGER trg_${DOC_ALIAS}_set_timestamp
            BEFORE UPDATE ON ${TB_DOCS}
            FOR EACH ROW
            EXECUTE FUNCTION set_timestamp();
          END IF;
        END $$;
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_employeesdocuments_employee_id
          ON ${TB_DOCS} (employee_id);
        CREATE INDEX IF NOT EXISTS idx_employeesdocuments_active
          ON ${TB_DOCS} (is_active);
      `);

      await syncSerialSequence(client, TB, PK);
      await syncSerialSequence(client, TB_DOCS, PK_DOCS);

      await client.query('COMMIT');
      return { ok: true };
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch { }
      throw e;
    } finally {
      try { await advisoryUnlock(client, LOCK_KEY); } catch { }
      client.release();
    }
  }).catch((e) => {
    _ensurePromise = null;
    throw e;
  });

  return _ensurePromise;
}
