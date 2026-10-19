// ╔══════════════════════════════════════════════════════════════╗
// ║ productMovementsCreate.repository.js — registerProductMovement║
// ║ Centralizador de Registros de Produto (INSERT)              ║
// ║ Tabela: public."productMovements"                           ║
// ╚══════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_PRODUCT_MOVEMENTS } from './productMovements.constants.js';

export async function registerProductMovement({
  client = pool,

  product_code,
  movement_type,
  origin_module,
  origin_table = null,
  origin_id = null,

  quantity = null,
  previous_stock = null,
  new_stock = null,

  unit = null,
  lot_code = null,
  nfe_key = null,
  nfe_number = null,

  notes = null,
  user_id = null,
  metadata = {},
}) {
  const sku = String(product_code || '').trim();

  if (!sku) {
    console.warn('[productMovements][SKIP] product_code empty');
    return null;
  }

  if (!movement_type) {
    throw new Error('movement_type is required');
  }

  if (!origin_module) {
    throw new Error('origin_module is required');
  }

  const sql = `
    INSERT INTO ${TB_PRODUCT_MOVEMENTS} (
      product_code,
      movement_type,
      origin_module,
      origin_table,
      origin_id,
      quantity,
      previous_stock,
      new_stock,
      unit,
      lot_code,
      nfe_key,
      nfe_number,
      notes,
      user_id,
      metadata
    )
    VALUES (
      $1,$2,$3,$4,$5,
      $6,$7,$8,$9,$10,
      $11,$12,$13,$14,$15
    )
    RETURNING *
  `;

  const values = [
    sku,
    movement_type,
    origin_module,
    origin_table,
    origin_id ? String(origin_id) : null,
    quantity,
    previous_stock,
    new_stock,
    unit,
    lot_code,
    nfe_key,
    nfe_number,
    notes,
    user_id ? String(user_id) : null,
    JSON.stringify(metadata || {}),
  ];

  const { rows } = await client.query(sql, values);

  return rows[0];
}

export default registerProductMovement;
