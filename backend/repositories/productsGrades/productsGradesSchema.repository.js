// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsGradesSchema.repository.js — ensureTable                   ║
// ║ Tabela: public."productsGrades" (+ índice único e trigger)         ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, TB_GRADES, nowSql } from './productsGrades.constants.js';

export async function ensureTable() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS ${TB}(
        product_grade_id SERIAL PRIMARY KEY,
        product_id TEXT NOT NULL,
        grade_id INTEGER NOT NULL REFERENCES ${TB_GRADES}(grade_id) ON DELETE RESTRICT,
        stock INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT ${nowSql},
        updated_at TIMESTAMP DEFAULT ${nowSql}
      );
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_indexes
          WHERE indexname = 'uq_productsgrades_product_grade'
        ) THEN
          CREATE UNIQUE INDEX uq_productsgrades_product_grade
          ON ${TB}(product_id, grade_id);
        END IF;
      END$$;
    `);

    await client.query(`
      CREATE OR REPLACE FUNCTION set_timestamp_products_grades()
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
          SELECT 1
          FROM pg_trigger
          WHERE tgname = 'trg_products_grades_set_timestamp'
        ) THEN
          CREATE TRIGGER trg_products_grades_set_timestamp
          BEFORE UPDATE ON ${TB}
          FOR EACH ROW
          EXECUTE FUNCTION set_timestamp_products_grades();
        END IF;
      END$$;
    `);

    await client.query('COMMIT');

    return { ok: true };

  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
