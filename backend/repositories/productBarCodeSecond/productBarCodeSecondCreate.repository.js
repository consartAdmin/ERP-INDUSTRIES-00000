// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ productBarCodeSecondCreate.repository.js — create / upsert              ║
// ║ Tabela principal: public."productBarCodeSecond"                          ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, COLS, DEFAULT_PRICE_ID } from './productBarCodeSecond.constants.js';
import { notEmptyStr, uniqueViolation } from './productBarCodeSecond.sanitizers.js';
import { mapRow } from './productBarCodeSecond.mappers.js';

// ──────────────────────────────────────────────────────────────────────────────
// Create / Upsert
// ──────────────────────────────────────────────────────────────────────────────
export async function createSecondBarCode(payload = {}) {
  const errors = [];
  if (!notEmptyStr(payload?.product_code)) {
    errors.push('O campo "product_code" é obrigatório.');
  }
  if (
    payload?.product_unit_id === undefined ||
    payload.product_unit_id === null ||
    payload.product_unit_id === ''
  ) {
    errors.push('O campo "product_unit_id" é obrigatório.');
  }
  if (!notEmptyStr(payload?.second_bar_code)) {
    errors.push('O campo "second_bar_code" é obrigatório.');
  }

  if (errors.length) {
    const e = new Error('ValidationError');
    e.status = 400;
    e.details = errors;
    throw e;
  }

  const product_code    = String(payload.product_code).trim();
  const product_unit_id = Number(payload.product_unit_id);
  const second_bar_code = String(payload.second_bar_code).trim();
  const code_type = notEmptyStr(payload?.code_type)
    ? String(payload.code_type).trim()
    : 'EAN-13';

  // 🔹 Se não vier nada, usa ALWAYS price_id = 2 (ATCDO.)
  const rawPriceId = payload.price_id;
  let price_id =
    rawPriceId === undefined || rawPriceId === null || rawPriceId === ''
      ? DEFAULT_PRICE_ID
      : Number(rawPriceId);
  if (Number.isNaN(price_id)) price_id = DEFAULT_PRICE_ID;

  try {
    const { rows: [row] } = await pool.query(
      `
      INSERT INTO public.${TB} (
        ${COLS.product_code},
        ${COLS.product_unit_id},
        ${COLS.second_bar_code},
        ${COLS.code_type},
        ${COLS.price_id}
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
      `,
      [product_code, product_unit_id, second_bar_code, code_type, price_id]
    );
    return mapRow(row);
  } catch (err) {
    if (uniqueViolation(err)) {
      const e = new Error(
        `Já existe o segundo código de barras "${second_bar_code}" para o produto ${product_code} na unidade ${product_unit_id}.`
      );
      e.status = 409;
      throw e;
    }
    throw err;
  }
}

export async function upsertSecondBarCode(payload = {}) {
  const errors = [];
  if (!notEmptyStr(payload?.product_code)) {
    errors.push('O campo "product_code" é obrigatório.');
  }
  if (
    payload?.product_unit_id === undefined ||
    payload.product_unit_id === null ||
    payload.product_unit_id === ''
  ) {
    errors.push('O campo "product_unit_id" é obrigatório.');
  }
  if (!notEmptyStr(payload?.second_bar_code)) {
    errors.push('O campo "second_bar_code" é obrigatório.');
  }
  if (errors.length) {
    const e = new Error('ValidationError');
    e.status = 400;
    e.details = errors;
    throw e;
  }

  const product_code    = String(payload.product_code).trim();
  const product_unit_id = Number(payload.product_unit_id);
  const second_bar_code = String(payload.second_bar_code).trim();
  const code_type = notEmptyStr(payload?.code_type)
    ? String(payload.code_type).trim()
    : 'EAN-13';

  const rawPriceId = payload.price_id;
  let price_id =
    rawPriceId === undefined || rawPriceId === null || rawPriceId === ''
      ? DEFAULT_PRICE_ID
      : Number(rawPriceId);
  if (Number.isNaN(price_id)) price_id = DEFAULT_PRICE_ID;

  const { rows: [row] } = await pool.query(
    `
    INSERT INTO public.${TB} (
      ${COLS.product_code},
      ${COLS.product_unit_id},
      ${COLS.second_bar_code},
      ${COLS.code_type},
      ${COLS.price_id}
    )
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (${COLS.product_code}, ${COLS.product_unit_id}, ${COLS.second_bar_code})
    DO UPDATE SET
      ${COLS.code_type}  = EXCLUDED.${COLS.code_type},
      ${COLS.price_id}   = EXCLUDED.${COLS.price_id},
      ${COLS.updated_at} = NOW()
    RETURNING *;
    `,
    [product_code, product_unit_id, second_bar_code, code_type, price_id]
  );

  return mapRow(row);
}
