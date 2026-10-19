// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ordersRemove.repository.js — remove                                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { ORDERS_PRIMARY_KEY } from './orders.catalog.js';
import { TB_ORDERS } from './orders.constants.js';
import { qi } from './orders.sql.js';
import { ensureTables } from './ordersSchema.repository.js';
import { safeCreateOrderAuditLog } from './ordersAudit.repository.js';
import { reportOrdersError } from './orders.utils.js';
import { getById } from './ordersGetById.repository.js';

export async function remove(orderId, meta = {}) {
  await ensureTables();

  const id = Number(orderId);
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: 'ID inválido' };

  const beforeOrder = await getById(id);

  try {
    const r = await pool.query(
      `DELETE FROM ${TB_ORDERS} WHERE ${qi(ORDERS_PRIMARY_KEY)} = $1`,
      [id],
    );

    if (r.rowCount > 0) {
      await safeCreateOrderAuditLog({
        register_id: id,
        operation: 'DELETE',
        user_id: meta?.user_id ?? null,
        before: beforeOrder?.ok ? beforeOrder : null,
        after: null,
      });
    }

    return { ok: true, deleted: r.rowCount };
  } catch (err) {
    reportOrdersError('[ordersApi.remove] ERR:', err);
    return { ok: false, error: String(err.message || err) };
  }
}
