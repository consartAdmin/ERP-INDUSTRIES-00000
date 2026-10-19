// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsUnitsBarcode.repository.js — setActiveBarcode (productsBarCode) ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB, PBC_TB, COLS } from './productsUnits.constants.js';
import { normBarcode } from './productsUnits.sanitizers.js';
import { getPuProductCol, checkBarcodeColumn } from './productsUnitsCatalog.repository.js';
import { resolveProductCodeForBarcode } from './productsUnitsResolve.repository.js';

export async function setActiveBarcode(client, product_unit_id, barcode, opts = {}) {
  const bc = normBarcode(barcode);
  if (!product_unit_id) return;

  await client.query(
    `UPDATE public.${PBC_TB}
        SET is_active = FALSE,
            updated_at = NOW()
      WHERE product_unit_id = $1
        AND is_active IS TRUE`,
    [product_unit_id]
  );

  if (!bc) return;

  let product_code = opts?.product_code ? String(opts.product_code).trim() : null;
  if (!product_code) {
    const puProductCol = await getPuProductCol();
    const { rows } = await client.query(
      `SELECT pu.${puProductCol} AS product_code
         FROM public.${TB} pu
        WHERE pu.${COLS.id} = $1
        LIMIT 1`,
      [product_unit_id]
    );
    const sku = rows[0]?.product_code ? String(rows[0].product_code).trim() : null;
    if (sku) product_code = await resolveProductCodeForBarcode(client, sku);
  }

  // fallback: se não resolver product_code, grava no barcode legado (se existir)
  if (!product_code) {
    const hasBarcodeCol = await checkBarcodeColumn();
    if (hasBarcodeCol) {
      await client.query(
        `UPDATE public.${TB}
            SET ${COLS.barcode} = $2,
                ${COLS.updated_at} = NOW()
          WHERE ${COLS.id} = $1`,
        [product_unit_id, bc]
      );
    }
    return;
  }

  const { rowCount } = await client.query(
    `UPDATE public.${PBC_TB}
        SET is_active = TRUE,
            updated_at = NOW()
      WHERE product_unit_id = $1
        AND barcode = $2`,
    [product_unit_id, bc]
  );
  if (rowCount > 0) return;

  const existing = await client.query(
    `SELECT barcode_id
       FROM public.${PBC_TB}
      WHERE barcode = $1
      LIMIT 1`,
    [bc]
  );

  if (existing.rows.length) {
    await client.query(
      `UPDATE public.${PBC_TB}
          SET product_code = $1,
              product_unit_id = $2,
              is_active = TRUE,
              updated_at = NOW()
        WHERE barcode_id = $3`,
      [product_code, product_unit_id, existing.rows[0].barcode_id]
    );
    return;
  }

  await client.query(
    `INSERT INTO public.${PBC_TB}
       (product_code, product_unit_id, barcode, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, TRUE, NOW(), NOW())`,
    [product_code, product_unit_id, bc]
  );
}
