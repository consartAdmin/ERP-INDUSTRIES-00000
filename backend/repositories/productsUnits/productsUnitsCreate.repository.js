// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsUnitsCreate.repository.js — createProductsUnit / upsertProductsUnit ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, COLS } from './productsUnits.constants.js';
import { notEmptyStr, toNumber, uniqueViolation, normBarcode, pickProductCode } from './productsUnits.sanitizers.js';
import { getPuProductCol, checkBarcodeColumn } from './productsUnitsCatalog.repository.js';
import { resolveIncomingProductCodeMaybeId, resolveUnitId } from './productsUnitsResolve.repository.js';
import { setActiveBarcode } from './productsUnitsBarcode.repository.js';
import { getProductsUnitById } from './productsUnitsQuery.repository.js';

/* ──────────────────────────────────────────────────────────────────────────────
   Create / Upsert
───────────────────────────────────────────────────────────────────────────── */
export async function createProductsUnit(payload = {}) {
  const hasBarcodeCol = await checkBarcodeColumn();
  const puProductCol = await getPuProductCol();

  const errors = [];
  let product_code = pickProductCode(payload);
  if (product_code) product_code = await resolveIncomingProductCodeMaybeId(product_code);
  if (!product_code) errors.push('O campo "product_code" é obrigatório (aceita product_id como legado).');

  if (!notEmptyStr(payload?.unit)) errors.push('O campo "unit" é obrigatório.');
  else if (payload.unit.trim().length > 50) errors.push('O campo "unit" deve ter no máximo 50 caracteres.');

  const fator = toNumber(payload?.fator, 1);
  if (fator !== null && (Number.isNaN(fator) || fator <= 0)) errors.push('O campo "fator" deve ser numérico > 0.');

  const barcode = normBarcode(payload?.barcode);
  if (barcode !== null && barcode !== undefined && String(barcode).length > 50) {
    errors.push('O campo "barcode" deve ter no máximo 50 caracteres.');
  }

  if (errors.length) {
    const e = new Error('ValidationError');
    e.status = 400;
    e.details = errors;
    throw e;
  }

  let unit_id =
    payload?.unit_id !== undefined && payload.unit_id !== null && payload.unit_id !== ''
      ? Number(payload.unit_id)
      : null;

  const unit = String(payload.unit).trim().toUpperCase();
  const description = payload?.description ?? null;
  const standard = payload?.standard === undefined ? false : !!payload.standard;

  if (unit_id == null) unit_id = await resolveUnitId(unit);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (standard === true) {
      await client.query(
        `
          UPDATE public.${TB}
             SET ${COLS.standard} = FALSE, ${COLS.updated_at} = NOW()
           WHERE ${puProductCol} = $1
             AND ${COLS.standard} IS TRUE
        `,
        [product_code]
      );
    }

    const cols = [puProductCol, COLS.unit_id, COLS.unit, COLS.fator, COLS.description, COLS.standard, COLS.is_active];
    const args = [product_code, unit_id, unit, fator ?? 1, description, standard];
    const vals = ['$1', '$2', '$3', '$4', '$5', '$6', 'TRUE'];

    if (hasBarcodeCol) {
      cols.splice(5, 0, COLS.barcode);
      vals.splice(5, 0, '$6');
      vals[vals.length - 2] = '$7';
      args.splice(5, 0, barcode ?? null);
    }

    const { rows: [row] } = await client.query(
      `
        INSERT INTO public.${TB} (${cols.join(', ')})
        VALUES (${vals.join(', ')})
        RETURNING ${COLS.id} AS product_unit_id;
      `,
      args
    );

    if (payload?.barcode !== undefined) {
      await setActiveBarcode(client, row.product_unit_id, payload.barcode, { product_code });
    }

    await client.query('COMMIT');
    return await getProductsUnitById(row.product_unit_id);
  } catch (err) {
    await client.query('ROLLBACK');
    if (uniqueViolation(err)) {
      const e = new Error(`Já existe a unidade "${String(payload.unit).trim().toUpperCase()}" para o produto ${product_code}.`);
      e.status = 409;
      throw e;
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function upsertProductsUnit(payload = {}) {
  const hasBarcodeCol = await checkBarcodeColumn();
  const puProductCol = await getPuProductCol();

  // product_code (padrão) + compat (product_id/productId/sku)
  let product_code = pickProductCode(payload);
  if (product_code) product_code = await resolveIncomingProductCodeMaybeId(product_code);

  if (!product_code) {
    const e = new Error('O campo "product_code" é obrigatório (aceita product_id como legado).');
    e.status = 400;
    throw e;
  }

  if (!notEmptyStr(payload?.unit)) {
    const e = new Error('O campo "unit" é obrigatório.');
    e.status = 400;
    throw e;
  }

  // unit_id pode vir do front ou ser resolvido pela sigla
  let unit_id =
    payload?.unit_id !== undefined && payload.unit_id !== null && payload.unit_id !== ''
      ? Number(payload.unit_id)
      : null;

  // Normaliza unit (opcionalmente remove ponto final pra evitar "UN" vs "UN.")
  let unit = String(payload.unit).trim().toUpperCase();
  unit = unit.replace(/\s+/g, ' ');
  if (unit.endsWith('.')) unit = unit.slice(0, -1); // <- evita duplicidade por ponto

  const fator = toNumber(payload?.fator, 1);
  if (fator !== null && (Number.isNaN(fator) || fator <= 0)) {
    const e = new Error('O campo "fator" deve ser numérico > 0.');
    e.status = 400;
    throw e;
  }

  const description = payload?.description ?? null;
  const barcode = normBarcode(payload?.barcode);
  const standard = payload?.standard === undefined ? false : !!payload.standard;

  if (unit_id == null) unit_id = await resolveUnitId(unit);

  if (unit_id == null) {
    const e = new Error(`Não foi possível resolver unit_id para a unidade "${unit}". Cadastre/valide na tabela units.`);
    e.status = 400;
    throw e;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Se marcou "standard", desmarca as outras do mesmo produto
    if (standard === true) {
      await client.query(
        `
          UPDATE public.${TB}
             SET ${COLS.standard} = FALSE,
                 ${COLS.updated_at} = NOW()
           WHERE ${puProductCol} = $1
             AND ${COLS.standard} IS TRUE
        `,
        [product_code]
      );
    }

    // INSERT dinâmico (com/sem barcode)
    const insertCols = [puProductCol, COLS.unit_id, COLS.unit, COLS.fator, COLS.description, COLS.standard, COLS.is_active];
    const insertVals = ['$1', '$2', '$3', '$4', '$5', '$6', 'TRUE'];
    const args = [product_code, unit_id, unit, fator ?? 1, description, standard];

    const updates = [
      `${COLS.unit}        = EXCLUDED.${COLS.unit}`,
      `${COLS.fator}       = EXCLUDED.${COLS.fator}`,
      `${COLS.description} = EXCLUDED.${COLS.description}`,
      `${COLS.standard}    = EXCLUDED.${COLS.standard}`,
      `${COLS.is_active}   = TRUE`,
      `${COLS.updated_at}  = NOW()`,
    ];

    if (hasBarcodeCol) {
      // insere barcode antes do standard (mantendo teu padrão)
      insertCols.splice(5, 0, COLS.barcode);
      insertVals.splice(5, 0, '$6');
      insertVals[insertVals.length - 2] = '$7'; // ajusta placeholder do standard
      args.splice(5, 0, barcode ?? null);

      updates.splice(3, 0, `${COLS.barcode} = EXCLUDED.${COLS.barcode}`);
    }

    // ✅ O CONFLICT CORRETO NO TEU BANCO: (product_code, unit_id)
    // (não em unit)
    const conflictTarget = `(${puProductCol}, ${COLS.unit_id})`;

    const { rows: [row] } = await client.query(
      `
        INSERT INTO public.${TB} (${insertCols.join(', ')})
        VALUES (${insertVals.join(', ')})
        ON CONFLICT ${conflictTarget}
        DO UPDATE SET
          ${updates.join(', ')}
        RETURNING ${COLS.id} AS product_unit_id;
      `,
      args
    );

    // Se barcode veio no payload, sincroniza productsBarCode (fonte oficial)
    if (payload?.barcode !== undefined) {
      await setActiveBarcode(client, row.product_unit_id, payload.barcode, { product_code });
    }

    await client.query('COMMIT');
    return await getProductsUnitById(row.product_unit_id);
  } catch (err) {
    await client.query('ROLLBACK');

    // Mantém 23505 legível (quando existir outra constraint além da esperada)
    if (uniqueViolation(err)) {
      const e = new Error('Conflito de unicidade ao salvar unidade (verifique constraints/duplicidades).');
      e.status = 409;
      e.original = err;
      throw e;
    }

    throw err;
  } finally {
    client.release();
  }
}

