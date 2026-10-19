// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsKitsRemove.repository.js — deleteProductsKit / hardDeleteProductsKit ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_KITS } from './productsKits.constants.js';

export async function deleteProductsKit(id) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const kitResult = await client.query(`
      UPDATE ${TB_KITS}
      SET active = FALSE,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [id]);

    const kit = kitResult.rows[0] || null;

    if (kit?.kit_sku) {
      await client.query(`
        UPDATE public.products
        SET is_active = FALSE,
            updated_at = NOW()
        WHERE product_code = $1
      `, [kit.kit_sku]);
    }

    await client.query('COMMIT');

    return kit;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function hardDeleteProductsKit(id) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const kitResult = await client.query(`
      SELECT *
      FROM ${TB_KITS}
      WHERE id = $1
      LIMIT 1
    `, [id]);

    const kit = kitResult.rows[0] || null;

    const result = await client.query(`
      DELETE FROM ${TB_KITS}
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (kit?.kit_sku) {
      await client.query(`
        DELETE FROM public.products
        WHERE product_code = $1
      `, [kit.kit_sku]);
    }

    await client.query('COMMIT');

    return result.rows[0] || null;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}