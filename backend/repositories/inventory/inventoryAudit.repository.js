// ╔════════════════════════════════════════════════════════════════════╗
// ║ inventoryAudit.repository.js — insertLog / listLogs                ║
// ║ Tabela: public."inventoryLogs"                                     ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_LOGS } from './inventory.constants.js';
import { q } from './inventory.utils.js';
import { normalizeUserCtx } from './inventory.sanitizers.js';
import { rowToLog } from './inventory.mappers.js';

export async function insertLog(
  client,
  {
    inventory_id,
    inventory_item_id = null,
    action,
    product_code = null,
    product_name = null,
    unit = null,
    system_qty_before = null,
    counted_qty = null,
    system_qty_after = null,
    userCtx = {},
  },
) {
  const { user_id, user_name } = normalizeUserCtx(userCtx);

  await q(
    client,
    'insertLog',
    `
    INSERT INTO ${TB_LOGS}
      (inventory_id,
       inventory_item_id,
       user_id,
       user_name,
       action,
       product_code,
       product_name,
       unit,
       system_qty_before,
       counted_qty,
       system_qty_after)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11);
    `,
    [
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
    ],
  );
}

// ──────────────────────────────────────────────────────────────
// LOGS
// ──────────────────────────────────────────────────────────────
export async function listLogs({ inventory_id, dateFrom, dateTo, userName, productCode } = {}) {
  if (!inventory_id) throw new Error('inventory_id is required to list logs');

  const params = [inventory_id];
  const where = ['log.inventory_id = $1'];

  if (dateFrom) {
    params.push(dateFrom);
    where.push(`log.created_at >= $${params.length}`);
  }
  if (dateTo) {
    params.push(`${dateTo} 23:59:59`);
    where.push(`log.created_at <= $${params.length}`);
  }
  if (userName) {
    params.push(`%${userName}%`);
    where.push(`(log.user_name ILIKE $${params.length} OR u.name ILIKE $${params.length})`);
  }
  if (productCode) {
    params.push(`%${productCode}%`);
    where.push(`log.product_code ILIKE $${params.length}`);
  }

  const sql = `
    SELECT
      log.*,
      COALESCE(log.user_name, u.name) AS user_name_resolved
    FROM ${TB_LOGS} log
    LEFT JOIN public.users u
           ON u.id = log.user_id
    WHERE ${where.join(' AND ')}
    ORDER BY log.created_at DESC, log.log_id DESC;
  `;

  const { rows } = await q(pool, 'logs.list', sql, params);
  return rows.map(rowToLog);
}
