// ╔════════════════════════════════════════════════════════════════════╗
// ║ inventoryLogsCreate.repository.js — registerLog (INSERT)           ║
// ║ Tabela: public."inventoryLogs"                                     ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './inventoryLogs.constants.js';
import { mapLogRow } from './inventoryLogs.mappers.js';

/* ───────────────────── Registrar um log (INSERT) ─────────────────── */

export async function registerLog({
  inventory_id,
  inventory_item_id = null,
  user_id = null,
  user_name = null,
  action,
  product_code = null,
  product_name = null,
  unit = null,
  system_qty_before = null,
  counted_qty = null,
  system_qty_after = null,
}) {
  if (!inventory_id) {
    throw new Error('inventoryLogsApi.registerLog: inventory_id é obrigatório');
  }
  if (!action) {
    throw new Error('inventoryLogsApi.registerLog: action é obrigatório');
  }

  const sql = `
    INSERT INTO ${TB} (
      inventory_id,
      inventory_item_id,
      user_id,
      user_name,
      action,
      product_code,
      product_name,
      unit,
      system_qty_before,
      counted_qty,
      system_qty_after
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    RETURNING *;
  `;

  const params = [
    inventory_id,
    inventory_item_id,
    user_id,
    user_name,
    action,
    product_code,
    product_name,
    unit,
    system_qty_before,
    counted_qty,
    system_qty_after,
  ];

  const { rows } = await pool.query(sql, params);
  return mapLogRow(rows[0]);
}
