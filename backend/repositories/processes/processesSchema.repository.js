// ╔════════════════════════════════════════════════════════════════════╗
// ║ processesSchema.repository.js — ensureTable                        ║
// ║ Tabela, índices, trigger updated_at e sync da sequence             ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, ALIAS, nowSql } from './processes.constants.js';

/* ──────────────────────────────────────────────────────────────
   ensureTable() — Cria tabela e estrutura de suporte
────────────────────────────────────────────────────────────── */
export async function ensureTable() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Tabela base
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${TB} (
        id BIGSERIAL PRIMARY KEY,
        codigo VARCHAR(50) UNIQUE NOT NULL,
        nome VARCHAR(200) NOT NULL,
        descricao TEXT,
        status VARCHAR(20) DEFAULT 'ativo',
        created_at TIMESTAMP DEFAULT ${nowSql},
        updated_at TIMESTAMP DEFAULT ${nowSql},
        deleted_at TIMESTAMP
      );
    `);

    // Índice para busca rápida por nome/código
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes WHERE indexname = 'idx_processes_codigo_unique'
        ) THEN
          CREATE UNIQUE INDEX idx_processes_codigo_unique
          ON ${TB} (LOWER(codigo));
        END IF;
      END$$;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_processes_nome   ON ${TB} (LOWER(nome));
      CREATE INDEX IF NOT EXISTS idx_processes_status ON ${TB} (status);
    `);

    // Função e trigger para updated_at
    await client.query(`
      CREATE OR REPLACE FUNCTION set_timestamp_processes()
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
          EXECUTE FUNCTION set_timestamp_processes();
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
        SELECT pg_get_serial_sequence('public.processes', 'id') INTO seq_name;
        IF seq_name IS NOT NULL THEN
          EXECUTE 'SELECT COALESCE(MAX(id), 0) FROM public.processes' INTO max_id;
          EXECUTE format('SELECT setval(%L, GREATEST(%s, 1), true)', seq_name, max_id);
        END IF;
      END$$;
    `);

    await client.query('COMMIT');
    return { ok: true };
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ [processesApi.ensureTable] erro:', e.message);
    throw e;
  } finally {
    client.release();
  }
}
