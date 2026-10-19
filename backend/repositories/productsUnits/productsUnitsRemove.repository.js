// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsUnitsRemove.repository.js — deactivateProductsUnit / deleteProductsUnit ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, PBC_TB, COLS } from './productsUnits.constants.js';
import { getPuProductCol } from './productsUnitsCatalog.repository.js';
import { setActiveBarcode } from './productsUnitsBarcode.repository.js';
import { getProductsUnitById } from './productsUnitsQuery.repository.js';

export async function deactivateProductsUnit(id) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [row] } = await client.query(
      `
        UPDATE public.${TB}
           SET ${COLS.is_active} = FALSE,
               ${COLS.standard}  = FALSE,
               ${COLS.updated_at} = NOW()
         WHERE ${COLS.id} = $1
        RETURNING ${COLS.id} AS product_unit_id;
      `,
      [id]
    );

    if (!row) {
      await client.query('COMMIT');
      return null;
    }

    await setActiveBarcode(client, row.product_unit_id, null, {});

    await client.query('COMMIT');
    return await getProductsUnitById(row.product_unit_id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteProductsUnit(id) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const puProductCol = await getPuProductCol();

    const { rows: curRows } = await client.query(
      `SELECT ${puProductCol} AS product_code, ${COLS.standard} AS standard
         FROM public.${TB}
        WHERE ${COLS.id} = $1
        LIMIT 1`,
      [id]
    );

    if (!curRows.length) {
      await client.query('COMMIT');
      return false;
    }

    const { product_code, standard } = curRows[0];

    await client.query(
      `UPDATE public.${PBC_TB}
          SET is_active = FALSE, updated_at = NOW()
        WHERE product_unit_id = $1`,
      [id]
    );

    await client.query(
      `UPDATE public.${TB}
          SET ${COLS.is_active} = FALSE,
              ${COLS.standard}  = FALSE,
              ${COLS.updated_at} = NOW()
        WHERE ${COLS.id} = $1`,
      [id]
    );

    if (standard === true && product_code) {
      await client.query(
        `
        WITH next_std AS (
          SELECT ${COLS.id} AS id
            FROM public.${TB}
           WHERE ${puProductCol} = $1
             AND ${COLS.is_active} IS DISTINCT FROM FALSE
           ORDER BY ${COLS.updated_at} DESC, ${COLS.id} DESC
           LIMIT 1
        )
        UPDATE public.${TB}
           SET ${COLS.standard} = TRUE,
               ${COLS.updated_at} = NOW()
          FROM next_std
         WHERE public.${TB}.${COLS.id} = next_std.id;
        `,
        [product_code]
      );
    }

    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
