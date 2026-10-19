// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsKeySchema.repository.js — ensureTable + indexes            ║
// ║ Tabela: public."productsKey"                                       ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, TB_PRODUCTS } from './productsKey.constants.js';

async function hasFunctionSetTimestamp(client) {
  const { rows } = await client.query(
    `SELECT 1 FROM pg_proc WHERE proname = 'set_timestamp' LIMIT 1`
  );
  return rows.length > 0;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Ensure table + indexes                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

export async function ensureTable() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${TB} (
        products_key_id  BIGSERIAL PRIMARY KEY,
        product_code     VARCHAR(50) NOT NULL,
        word_keys        TEXT NOT NULL,
        word_keys_norm   TEXT NOT NULL,
        created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_productsKey_product_code
          FOREIGN KEY (product_code)
          REFERENCES ${TB_PRODUCTS}(product_code)
          ON UPDATE CASCADE
          ON DELETE RESTRICT
      );
    `);

    // Indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_productsKey_word_keys_norm
      ON ${TB}(word_keys_norm);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_productsKey_product_code
      ON ${TB}(product_code);
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_productsKey_product_word_norm
      ON ${TB}(product_code, word_keys_norm);
    `);

    // Trigger updated_at (optional)
    const okFn = await hasFunctionSetTimestamp(client);
    if (okFn) {
      await client.query(`
        DROP TRIGGER IF EXISTS trg_productsKey_set_timestamp ON ${TB};
      `);
      await client.query(`
        CREATE TRIGGER trg_productsKey_set_timestamp
        BEFORE UPDATE ON ${TB}
        FOR EACH ROW
        EXECUTE FUNCTION set_timestamp();
      `);
    }

    await client.query('COMMIT');
    return { ok: true, table: 'productsKey' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
