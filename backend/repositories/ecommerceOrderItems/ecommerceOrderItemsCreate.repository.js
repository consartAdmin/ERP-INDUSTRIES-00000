// ╔════════════════════════════════════════════════════════════════════╗
// ║ ecommerceOrderItemsCreate.repository.js — createItem / bulkInsert  ║
// ║ Tabela: "ecommerceOrderItems"                                      ║
// ╚════════════════════════════════════════════════════════════════════╝

import { q } from './ecommerceOrderItems.utils.js';

/* =========================================================================
   CREATE / BULK INSERT
============================================================================*/

export async function createItem(payload = {}) {
  const cols = [
    'order_id',
    'product_id',
    'product_code',
    'name',
    'unit',
    'qty',
    'price',
    'total',
  ];

  const insertCols = [];
  const vals = [];
  const params = [];
  let i = 1;

  for (const c of cols) {
    const v = payload[c];
    if (v === undefined) continue;
    insertCols.push(c);
    vals.push(`$${i++}`);
    params.push(v);
  }

  if (!insertCols.length) {
    throw new Error('ecommerceOrderItemsApi.createItem: payload vazio');
  }

  const sql = `
    INSERT INTO "ecommerceOrderItems" (${insertCols.join(',')})
    VALUES (${vals.join(',')})
    RETURNING *
  `;
  const res = await q(sql, params);
  return res.rows[0];
}

/**
 * Insere vários itens de uma vez para um order_id
 * items: [{ product_id, product_code, name, unit, qty, price, total }, ...]
 */
export async function bulkInsert(order_id, items = []) {
  if (!order_id) {
    throw new Error('bulkInsert: order_id é obrigatório');
  }
  if (!Array.isArray(items) || !items.length) {
    return [];
  }

  const inserted = [];
  for (const it of items) {
    const payload = {
      ...it,
      order_id,
    };
    const row = await createItem(payload);
    inserted.push(row);
  }
  return inserted;
}
