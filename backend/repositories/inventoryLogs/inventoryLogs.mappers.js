// ╔════════════════════════════════════════════════════════════════════╗
// ║ inventoryLogs.mappers.js — Linha do banco → objeto de log          ║
// ╚════════════════════════════════════════════════════════════════════╝

/* ───────────────────────────── Helpers ───────────────────────────── */

export function mapLogRow(row) {
  if (!row) return null;
  return {
    log_id: row.log_id,
    inventory_id: row.inventory_id,
    inventory_item_id: row.inventory_item_id,
    user_id: row.user_id,
    user_name: row.user_name,
    action: row.action,
    product_code: row.product_code,
    product_name: row.product_name,
    unit: row.unit,
    system_qty_before: row.system_qty_before,
    counted_qty: row.counted_qty,
    system_qty_after: row.system_qty_after,
    created_at: row.created_at,
  };
}
