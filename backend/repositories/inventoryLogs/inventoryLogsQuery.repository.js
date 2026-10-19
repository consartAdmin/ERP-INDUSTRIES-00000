// ╔════════════════════════════════════════════════════════════════════╗
// ║ inventoryLogsQuery.repository.js — listByInventory                 ║
// ║ Tabela: public."inventoryLogs"                                     ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './inventoryLogs.constants.js';
import { mapLogRow } from './inventoryLogs.mappers.js';

/* ───────────────────── Listar logs por inventário ────────────────── */

export async function listByInventory({
  inventory_id,
  date_from = null,
  date_to = null,
  user = null,
  product_code = null,
  limit = 500,
  offset = 0,
}) {
  if (!inventory_id) {
    throw new Error('inventoryLogsApi.listByInventory: inventory_id é obrigatório');
  }

  const where = ['inventory_id = $1'];
  const params = [inventory_id];
  let idx = 2;

  if (date_from) {
    where.push(`created_at::date >= $${idx++}::date`);
    params.push(date_from);
  }

  if (date_to) {
    where.push(`created_at::date <= $${idx++}::date`);
    params.push(date_to);
  }

  if (user) {
    where.push(`(user_name ILIKE '%' || $${idx} || '%')`);
    params.push(user);
    idx++;
  }

  if (product_code) {
    where.push(`(product_code ILIKE '%' || $${idx} || '%')`);
    params.push(product_code);
    idx++;
  }

  const sql = `
    SELECT *
    FROM ${TB}
    WHERE ${where.join(' AND ')}
    ORDER BY created_at DESC
    LIMIT $${idx} OFFSET $${idx + 1};
  `;

  params.push(limit, offset);

  const { rows } = await pool.query(sql, params);
  return {
    rows: rows.map(mapLogRow),
    limit,
    offset,
  };
}
