// ╔════════════════════════════════════════════════════════════════════╗
// ║ inventory.mappers.js — Linha do banco → inventário / item / log    ║
// ╚════════════════════════════════════════════════════════════════════╝

// ──────────────────────────────────────────────────────────────
// Mappers
// ──────────────────────────────────────────────────────────────
export const rowToInventory = (r) => ({
  inventory_id: r.inventory_id,
  code: r.code,
  description: r.description,
  type: r.type,
  status: r.status,
  reference_date: r.reference_date,
  notes: r.notes,
  created_by: r.created_by,
  finalized_by: r.finalized_by,
  created_at: r.created_at,
  updated_at: r.updated_at,
});

export const rowToItem = (r) => ({
  inventory_item_id: r.inventory_item_id,
  inventory_id: r.inventory_id,
  product_code: r.product_code,
  product_id: r.product_id ?? null,
  product_name: r.product_name,
  product_unit_id: r.product_unit_id,
  product_location_id: r.product_location_id,

  barcode: r.barcode ?? null,
  fator: r.fator != null ? Number(r.fator) : null,
  standard: r.standard ?? null,

  lot_id: r.lot_id ?? null,
  lot_code: r.lot_code ?? null,
  lot_expires_at: r.lot_expires_at ?? null,

  unit: r.unit || null,
  location_name: r.location_name || null,
  system_stock_qty: Number(r.system_stock_qty ?? 0),
  counted_qty: r.counted_qty != null ? Number(r.counted_qty) : null,
  difference_qty: r.difference_qty != null ? Number(r.difference_qty) : null,
  status: r.status,
  notes: r.notes,
  created_at: r.created_at,
  updated_at: r.updated_at,

  total_qty: r.total_qty != null
    ? Number(r.total_qty)
    : null,

});

export const rowToLog = (r) => ({
  log_id: r.log_id,
  inventory_id: r.inventory_id,
  inventory_item_id: r.inventory_item_id,
  user_id: r.user_id,
  user_name: r.user_name_resolved || r.user_name || null,
  action: r.action,
  product_code: r.product_code,
  product_name: r.product_name,
  unit: r.unit,
  system_qty_before: r.system_qty_before != null ? Number(r.system_qty_before) : null,
  counted_qty: r.counted_qty != null ? Number(r.counted_qty) : null,
  system_qty_after: r.system_qty_after != null ? Number(r.system_qty_after) : null,
  created_at: r.created_at,
});
