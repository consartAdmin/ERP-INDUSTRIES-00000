// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ productBarCodeSecondUpdate.repository.js — update / delete              ║
// ║ Tabela principal: public."productBarCodeSecond"                          ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, COLS } from './productBarCodeSecond.constants.js';
import { notEmptyStr, uniqueViolation } from './productBarCodeSecond.sanitizers.js';
import { mapRow } from './productBarCodeSecond.mappers.js';

// ──────────────────────────────────────────────────────────────────────────────
// Update / Delete
// ──────────────────────────────────────────────────────────────────────────────
export async function updateSecondBarCode(id, patch = {}) {
  const sets = [];
  const values = [];
  let i = 1;

  if (patch.product_code !== undefined) {
    if (!notEmptyStr(patch.product_code)) {
      const e = new Error('O campo "product_code" não pode ser vazio.');
      e.status = 400;
      throw e;
    }
    sets.push(`${COLS.product_code} = $${i++}`);
    values.push(String(patch.product_code).trim());
  }

  if (patch.product_unit_id !== undefined) {
    if (
      patch.product_unit_id === null ||
      patch.product_unit_id === '' ||
      Number.isNaN(Number(patch.product_unit_id))
    ) {
      const e = new Error('O campo "product_unit_id" deve ser numérico e obrigatório.');
      e.status = 400;
      throw e;
    }
    sets.push(`${COLS.product_unit_id} = $${i++}`);
    values.push(Number(patch.product_unit_id));
  }

  if (patch.second_bar_code !== undefined) {
    if (!notEmptyStr(patch.second_bar_code)) {
      const e = new Error('O campo "second_bar_code" não pode ser vazio.');
      e.status = 400;
      throw e;
    }
    sets.push(`${COLS.second_bar_code} = $${i++}`);
    values.push(String(patch.second_bar_code).trim());
  }

  if (patch.code_type !== undefined) {
    sets.push(`${COLS.code_type} = $${i++}`);
    values.push(
      notEmptyStr(patch.code_type) ? String(patch.code_type).trim() : null
    );
  }

  if (patch.price_id !== undefined) {
    if (patch.price_id === null || patch.price_id === '' || Number.isNaN(Number(patch.price_id))) {
      const e = new Error('O campo "price_id" deve ser numérico e não pode ser vazio.');
      e.status = 400;
      throw e;
    }
    sets.push(`${COLS.price_id} = $${i++}`);
    values.push(Number(patch.price_id));
  }

  if (!sets.length) {
    const e = new Error('Nada para atualizar.');
    e.status = 400;
    throw e;
  }

  const sql = `
    UPDATE public.${TB}
       SET ${sets.join(', ')}, ${COLS.updated_at} = NOW()
     WHERE ${COLS.id} = $${i}
    RETURNING *;
  `;
  values.push(id);

  try {
    const { rows: [row] } = await pool.query(sql, values);
    return mapRow(row);
  } catch (err) {
    if (uniqueViolation(err)) {
      const e = new Error(
        'Já existe outro registro com essa combinação (product_code, product_unit_id, second_bar_code).'
      );
      e.status = 409;
      throw e;
    }
    throw err;
  }
}

export async function deleteSecondBarCode(id) {
  const res = await pool.query(
    `DELETE FROM public.${TB} WHERE ${COLS.id} = $1`,
    [id]
  );
  return res.rowCount > 0;
}
