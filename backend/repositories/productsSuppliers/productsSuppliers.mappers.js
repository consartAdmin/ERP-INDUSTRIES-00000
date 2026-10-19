// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsSuppliers.mappers.js — Linha do banco → objeto             ║
// ╚════════════════════════════════════════════════════════════════════╝

export function normalizeRow(r = {}) {
  return {
    product_supplier_id: r.product_supplier_id,
    product_id: String(r.product_id),
    supplier_id: Number(r.supplier_id),
    is_primary: !!r.is_primary,
    created_at: r.created_at,
  };
}
