// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsUnits.mappers.js — linha do banco → objeto                 ║
// ╚════════════════════════════════════════════════════════════════════╝

export function mapRow(r) {
  if (!r) return null;
  return {
    product_unit_id: r.product_unit_id,
    product_code:    r.product_code, // sempre padronizado no SELECT
    unit_id:         r.unit_id,
    unit:            r.unit,
    fator:           r.fator,
    description:     r.description,
    barcode:         r.barcode ?? null,
    standard:        r.standard,
    is_active:       r.is_active,
    created_at:      r.created_at,
    updated_at:      r.updated_at,
  };
}
