// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ createItem.repository.js — CONSART ERP | Notas de Entrada               ║
// ║ Insere um item da NF-e de entrada (com product_grade_id)                 ║
// ╚══════════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  TB_III,
  q,
  itemResponse,
} from './_shared.js';

import {
  ITEM_WRITE_COLUMNS,
  normalizeItemForWrite,
} from './_itemColumns.js';

export async function createItem(payload) {
  console.log('[INBOUND][DAL][CREATE_ITEM][FISCAL]', {
    nf_product_code: payload.nf_product_code,
    icms_cst: payload.icms_cst,
    icms_base: payload.icms_base,
    icms_rate: payload.icms_rate,
    icms_st_base: payload.icms_st_base,
    icms_st_rate: payload.icms_st_rate,
    icms_st_value: payload.icms_st_value,
    nfe_key: payload.nfe_key,
    nfe_item_seq: payload.nfe_item_seq,
  });

  const data = normalizeItemForWrite(payload);
  const placeholders = ITEM_WRITE_COLUMNS.map((_, index) => `$${index + 1}`);
  const values = ITEM_WRITE_COLUMNS.map((column) => data[column] ?? null);

  const res = await q(
    `INSERT INTO ${TB_III} (${ITEM_WRITE_COLUMNS.join(', ')})
     VALUES (${placeholders.join(', ')})
     RETURNING *`,
    values
  );

  return itemResponse(res.rows[0]);
}

export default createItem;
