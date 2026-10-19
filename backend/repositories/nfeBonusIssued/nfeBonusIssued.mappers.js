// ╔═══════════════════════════════════════════════════════════════════════╗
// ║ nfeBonusIssued.mappers.js — NF-e Bonificação                          ║
// ║ Linha do banco -> objeto (bonificação e item)                         ║
// ╚═══════════════════════════════════════════════════════════════════════╝

// ======================================================================
// ROW MAPPERS
// ======================================================================

export function rowToBonus(row) {
  if (!row) return null;

  return {
    bonus_id: Number(row.bonus_id),

    customer_id:
      row.customer_id !== null
        ? Number(row.customer_id)
        : null,

    operation_type_id:
      row.operation_type_id !== null
        ? Number(row.operation_type_id)
        : null,

    operation_code: row.operation_code ?? null,
    operation_name: row.operation_name ?? null,
    nature_operation: row.nature_operation ?? null,

    cfop_internal: row.cfop_internal ?? null,
    cfop_interstate: row.cfop_interstate ?? null,

    generates_receivable:
      row.generates_receivable !== undefined
        ? Boolean(row.generates_receivable)
        : null,

    moves_stock:
      row.moves_stock !== undefined
        ? Boolean(row.moves_stock)
        : null,

    status: row.status,

    total_amount: Number(row.total_amount || 0),

    observations: row.observations ?? null,

    invoice_id:
      row.invoice_id !== null && row.invoice_id !== undefined
        ? Number(row.invoice_id)
        : null,

    created_by:
      row.created_by !== null && row.created_by !== undefined
        ? Number(row.created_by)
        : null,

    customer_name:
      row.customer_name ?? null,

    customer_trade_name:
      row.customer_trade_name ?? null,

    customer_tax_id:
      row.customer_tax_id ?? null,

    customer_state:
      row.customer_state ?? null,

    customer_city:
      row.customer_city ?? null,

    customer_email:
      row.customer_email ?? null,

    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}


export function rowToBonusItem(row) {
  if (!row) return null;

  return {
    bonus_item_id: Number(row.bonus_item_id),
    bonus_id: Number(row.bonus_id),

    product_id: Number(row.product_id),
    product_code: row.product_code,

    description:
      row.description ?? null,

    manufacturer_ref:
      row.manufacturer_ref ?? null,

    product_grade_id:
      row.product_grade_id !== null &&
      row.product_grade_id !== undefined
        ? Number(row.product_grade_id)
        : null,

    grade_id:
      row.grade_id !== null &&
      row.grade_id !== undefined
        ? Number(row.grade_id)
        : null,

    grade_name:
      row.grade_name ?? null,

    lot_id:
      row.lot_id !== null &&
      row.lot_id !== undefined
        ? Number(row.lot_id)
        : null,

    lot_code:
      row.lot_code ?? null,

    expires_at:
      row.expires_at ?? null,

    qty_on_hand:
      row.qty_on_hand !== null &&
      row.qty_on_hand !== undefined
        ? Number(row.qty_on_hand)
        : null,

    qty_reserved:
      row.qty_reserved !== null &&
      row.qty_reserved !== undefined
        ? Number(row.qty_reserved)
        : null,

    qty_available:
      row.qty_available !== null &&
      row.qty_available !== undefined
        ? Number(row.qty_available)
        : null,

    quantity: Number(row.quantity || 0),

    unit_value: Number(row.unit_value || 0),
    total_value: Number(row.total_value || 0),

    item_sequence: Number(row.item_sequence || 0),

    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
