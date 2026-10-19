// ╔════════════════════════════════════════════════════════════════════╗
// ║ processesUsersSchema.repository.js — ensureTable                   ║
// ║ Tabela, índices, trigger updated_at e sync da sequence             ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, ALIAS, nowSql } from './processesUsers.constants.js';

/* ──────────────────────────────────────────────────────────────
   ensureTable() — Cria tabela e estrutura de suporte
────────────────────────────────────────────────────────────── */
export async function ensureTable() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS ${TB} (
        id BIGSERIAL PRIMARY KEY,
        process_id BIGINT NOT NULL,
        user_id INTEGER NOT NULL,

        can_view    BOOLEAN NOT NULL DEFAULT TRUE,
        can_edit    BOOLEAN NOT NULL DEFAULT FALSE,
        can_approve BOOLEAN NOT NULL DEFAULT FALSE,
        is_owner    BOOLEAN NOT NULL DEFAULT FALSE,

        created_at TIMESTAMP DEFAULT ${nowSql},
        updated_at TIMESTAMP DEFAULT ${nowSql},
        deleted_at TIMESTAMP,

        CONSTRAINT uq_processes_users UNIQUE (process_id, user_id)
      );
    `);

    // Índices auxiliares
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_processes_users_process_id ON ${TB} (process_id);
      CREATE INDEX IF NOT EXISTS idx_processes_users_user_id    ON ${TB} (user_id);
      CREATE INDEX IF NOT EXISTS idx_processes_users_owner      ON ${TB} (is_owner);
    `);

    // Função e trigger para updated_at
    await client.query(`
      CREATE OR REPLACE FUNCTION set_timestamp_processes_users()
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
          BEFORE UPDATE ON ${TB}
          FOR EACH ROW
          EXECUTE FUNCTION set_timestamp_processes_users();
        END IF;
      END$$;
    `);

    // Sincroniza a sequence
    await client.query(`
      DO $$
      DECLARE
        seq_name text;
        max_id bigint;
      BEGIN
        SELECT pg_get_serial_sequence('public."processesUsers"', 'id') INTO seq_name;
        IF seq_name IS NOT NULL THEN
          EXECUTE 'SELECT COALESCE(MAX(id), 0) FROM public."processesUsers"' INTO max_id;
          EXECUTE format('SELECT setval(%L, GREATEST(%s, 1), true)', seq_name, max_id);
        END IF;
      END$$;
    `);

    await client.query('COMMIT');
    return { ok: true };
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ [processesUsersApi.ensureTable] erro:', e.message);
    throw e;
  } finally {
    client.release();
  }
}
