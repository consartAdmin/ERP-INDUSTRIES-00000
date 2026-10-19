// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsGroupsSchema.repository.js — ensureProductsGroupsTable     ║
// ║ DDL compatível com catalog_schema.productsGroups.js                ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, ALIAS, COLS } from './productsGroups.constants.js';

export async function ensureProductsGroupsTable() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.${TB} (
        ${COLS.id}        SERIAL PRIMARY KEY,
        ${COLS.name}      VARCHAR(100) NOT NULL UNIQUE,
        ${COLS.created_at} TIMESTAMP   DEFAULT NOW(),
        ${COLS.updated_at} TIMESTAMP   DEFAULT NOW(),
        ${COLS.is_active}  BOOLEAN     DEFAULT TRUE
      );
    `);

    // Índice de busca por nome (case-insensitive)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_${ALIAS}_name_ci
        ON public.${TB} (LOWER(${COLS.name}));
    `);

    // Função de updated_at (compartilhada)
    await client.query(`
      CREATE OR REPLACE FUNCTION trg_set_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.${COLS.updated_at} = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Trigger por tabela
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_${ALIAS}'
        ) THEN
          CREATE TRIGGER set_timestamp_${ALIAS}
          BEFORE UPDATE ON public.${TB}
          FOR EACH ROW
          EXECUTE PROCEDURE trg_set_timestamp();
        END IF;
      END;
      $$;
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
