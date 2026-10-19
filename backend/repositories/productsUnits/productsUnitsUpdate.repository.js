// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsUnitsUpdate.repository.js — updateProductsUnit             ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, COLS } from './productsUnits.constants.js';
import { notEmptyStr, toNumber, uniqueViolation, normBarcode, pickProductCode } from './productsUnits.sanitizers.js';
import { getPuProductCol, checkBarcodeColumn } from './productsUnitsCatalog.repository.js';
import { resolveIncomingProductCodeMaybeId } from './productsUnitsResolve.repository.js';
import { setActiveBarcode } from './productsUnitsBarcode.repository.js';
import { getProductsUnitById } from './productsUnitsQuery.repository.js';

/* ──────────────────────────────────────────────────────────────────────────────
   Update / Deactivate / Delete
───────────────────────────────────────────────────────────────────────────── */
export async function updateProductsUnit(id, patch = {}) {
  const hasBarcodeCol = await checkBarcodeColumn();
  const puProductCol = await getPuProductCol();

  const sets = [];
  const values = [];
  let i = 1;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let productCodeForClear = null;
    let patchCode = pickProductCode(patch);
    if (patchCode) patchCode = await resolveIncomingProductCodeMaybeId(patchCode);

    if (patchCode !== null && patchCode !== undefined) {
      productCodeForClear = patchCode;
      sets.push(`${puProductCol} = $${i++}`);
      values.push(productCodeForClear);
    }

    if (patch.unit_id !== undefined) {
      const v = (patch.unit_id === null || patch.unit_id === '') ? null : Number(patch.unit_id);
      if (v !== null && !Number.isFinite(v)) {
        const e = new Error('O campo "unit_id" deve ser numérico.');
        e.status = 400;
        throw e;
      }
      sets.push(`${COLS.unit_id} = $${i++}`);
      values.push(v);
    }

    if (patch.unit !== undefined) {
      if (!notEmptyStr(patch.unit)) { const e = new Error('O campo "unit" não pode ser vazio.'); e.status = 400; throw e; }
      sets.push(`${COLS.unit} = UPPER(BTRIM($${i++}))`);
      values.push(patch.unit);
    }

    if (patch.fator !== undefined) {
      const f = toNumber(patch.fator, null);
      if (f !== null && (Number.isNaN(f) || f <= 0)) { const e = new Error('O campo "fator" deve ser numérico > 0.'); e.status = 400; throw e; }
      sets.push(`${COLS.fator} = $${i++}`);
      values.push(f);
    }

    if (patch.description !== undefined) {
      sets.push(`${COLS.description} = $${i++}`);
      values.push(patch.description ?? null);
    }

    if (patch.is_active !== undefined) {
      sets.push(`${COLS.is_active} = $${i++}`);
      values.push(!!patch.is_active);
    }

    let barcodeToSet = undefined;
    if (patch.barcode !== undefined) {
      barcodeToSet = patch.barcode;
      if (hasBarcodeCol) {
        const bc = normBarcode(patch.barcode);
        sets.push(`${COLS.barcode} = $${i++}`);
        values.push(bc ?? null);
      }
    }

    let setStandard = null;
    if (patch.standard !== undefined) setStandard = !!patch.standard;

    if (setStandard === true && !productCodeForClear) {
      const { rows: current } = await client.query(
        `SELECT ${puProductCol} AS product_code FROM public.${TB} WHERE ${COLS.id} = $1`,
        [id]
      );
      productCodeForClear = current[0]?.product_code ? String(current[0].product_code).trim() : null;
    }

    if (setStandard === true && productCodeForClear) {
      await client.query(
        `
          UPDATE public.${TB}
             SET ${COLS.standard} = FALSE, ${COLS.updated_at} = NOW()
           WHERE ${puProductCol} = $1
             AND ${COLS.standard} IS TRUE
             AND ${COLS.id} <> $2
        `,
        [productCodeForClear, id]
      );
    }

    if (setStandard !== null) {
      sets.push(`${COLS.standard} = $${i++}`);
      values.push(setStandard);
    }

    if (!sets.length) { const e = new Error('Nada para atualizar.'); e.status = 400; throw e; }

    const sql = `
      UPDATE public.${TB}
         SET ${sets.join(', ')}, ${COLS.updated_at} = NOW()
       WHERE ${COLS.id} = $${i}
      RETURNING ${COLS.id} AS product_unit_id, ${puProductCol} AS product_code;
    `;
    values.push(id);

    const { rows: [row] } = await client.query(sql, values);

    if (patch.barcode !== undefined) {
      await setActiveBarcode(client, row.product_unit_id, barcodeToSet, { product_code: row.product_code });
    }

    if (patch.is_active === false) {
      await setActiveBarcode(client, row.product_unit_id, null, { product_code: row.product_code });
    }

    await client.query('COMMIT');
    return await getProductsUnitById(row.product_unit_id);
  } catch (err) {
    await client.query('ROLLBACK');
    if (uniqueViolation(err)) {
      const e = new Error('Já existe outra unidade com esse (product_code, unit).');
      e.status = 409;
      throw e;
    }
    throw err;
  } finally {
    client.release();
  }
}
