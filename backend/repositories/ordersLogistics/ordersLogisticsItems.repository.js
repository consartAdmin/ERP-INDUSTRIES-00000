// ╔════════════════════════════════════════════════════════════════════╗
// ║ ordersLogisticsItems.repository.js — itens da logística            ║
// ║ list / get / create / getOrCreate / increment* / update            ║
// ║ Tabela: "ordersLogisticsItems"                                     ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { BASE_SELECT_ITEMS } from './ordersLogistics.sql.js';

/**
 * Lista itens de logística por logistics_id.
 */
export async function listItemsByLogisticsId(logistics_id) {
  const sql = `
    ${BASE_SELECT_ITEMS}
    WHERE logistics_id = $1
    ORDER BY item_log_id ASC;
  `;
  const { rows } = await pool.query(sql, [logistics_id]);
  return rows;
}

/**
 * Busca item de logística por logistics_id + order_item_id.
 */
export async function getItem(logistics_id, order_item_id) {
  const sql = `
    ${BASE_SELECT_ITEMS}
    WHERE logistics_id = $1
      AND order_item_id = $2;
  `;
  const { rows } = await pool.query(sql, [logistics_id, order_item_id]);
  return rows[0] || null;
}

/**
 * Cria item logístico vinculado ao item do pedido.
 */
export async function createItem({
  logistics_id,
  order_item_id,
  sku,
  product_name,
  qty_ordered,
  qty_picked = 0,
  qty_checked = 0,
  location = null,
  obs = null
}) {
  const sql = `
    INSERT INTO "ordersLogisticsItems" (
      logistics_id,
      order_item_id,
      sku,
      product_name,
      qty_ordered,
      qty_picked,
      qty_checked,
      location,
      obs,
      updated_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
    RETURNING
      item_log_id,
      logistics_id,
      order_item_id,
      sku,
      product_name,
      qty_ordered,
      qty_picked,
      qty_checked,
      discrepancy_qty,
      location,
      obs,
      updated_at;
  `;
  const params = [
    logistics_id,
    order_item_id,
    sku,
    product_name,
    qty_ordered,
    qty_picked,
    qty_checked,
    location,
    obs
  ];

  const { rows } = await pool.query(sql, params);
  return rows[0];
}

/**
 * Garante que exista um item para o par logistics_id + order_item_id.
 * Se não existir, cria. Se existir, devolve.
 */
export async function getOrCreateItem({
  logistics_id,
  order_item_id,
  sku,
  product_name,
  qty_ordered,
  qty_picked = 0,
  location = null,
  obs = null
}) {
  const existing = await getItem(logistics_id, order_item_id);
  if (existing) return existing;

  return createItem({
    logistics_id,
    order_item_id,
    sku,
    product_name,
    qty_ordered,
    qty_picked,
    qty_checked: 0,
    location,
    obs
  });
}

/**
 * Incrementa quantidade separada (picking).
 */
export async function incrementPickedQty(logistics_id, order_item_id, deltaQty) {
  const sql = `
    UPDATE "ordersLogisticsItems"
       SET qty_picked = qty_picked + $3,
           updated_at = NOW()
     WHERE logistics_id = $1
       AND order_item_id = $2
    RETURNING
      item_log_id,
      logistics_id,
      order_item_id,
      sku,
      product_name,
      qty_ordered,
      qty_picked,
      qty_checked,
      discrepancy_qty,
      location,
      obs,
      updated_at;
  `;
  const { rows } = await pool.query(sql, [logistics_id, order_item_id, deltaQty]);
  return rows[0] || null;
}

/**
 * Incrementa quantidade conferida (conferência cega).
 * Ideal para uso a cada bip de produto.
 */
export async function incrementCheckedQty(logistics_id, order_item_id, deltaQty) {
  const sql = `
    UPDATE "ordersLogisticsItems"
       SET qty_checked = qty_checked + $3,
           updated_at = NOW()
     WHERE logistics_id = $1
       AND order_item_id = $2
    RETURNING
      item_log_id,
      logistics_id,
      order_item_id,
      sku,
      product_name,
      qty_ordered,
      qty_picked,
      qty_checked,
      discrepancy_qty,
      location,
      obs,
      updated_at;
  `;
  const { rows } = await pool.query(sql, [logistics_id, order_item_id, deltaQty]);
  return rows[0] || null;
}

/**
 * Atualiza campos livres de um item.
 */
export async function updateItem(item_log_id, fields = {}) {
  const allowedFields = [
    'qty_ordered',
    'qty_picked',
    'qty_checked',
    'location',
    'obs'
  ];

  const sets = [];
  const values = [];
  let idx = 1;

  for (const key of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      sets.push(`"${key}" = $${idx++}`);
      values.push(fields[key]);
    }
  }

  if (sets.length === 0) {
    return getItemById(item_log_id);
  }

  sets.push('updated_at = NOW()');
  values.push(item_log_id);

  const sql = `
    UPDATE "ordersLogisticsItems"
       SET ${sets.join(', ')}
     WHERE item_log_id = $${idx}
    RETURNING
      item_log_id,
      logistics_id,
      order_item_id,
      sku,
      product_name,
      qty_ordered,
      qty_picked,
      qty_checked,
      discrepancy_qty,
      location,
      obs,
      updated_at;
  `;

  const { rows } = await pool.query(sql, values);
  return rows[0] || null;
}

/**
 * Busca item por ID.
 */
export async function getItemById(item_log_id) {
  const sql = `
    ${BASE_SELECT_ITEMS}
    WHERE item_log_id = $1;
  `;
  const { rows } = await pool.query(sql, [item_log_id]);
  return rows[0] || null;
}
