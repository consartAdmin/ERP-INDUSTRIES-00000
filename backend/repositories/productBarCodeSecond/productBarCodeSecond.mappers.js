// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ productBarCodeSecond.mappers.js — Linha do banco → objeto da API        ║
// ╚══════════════════════════════════════════════════════════════════════════╝

export const mapRow = (r) =>
  r && {
    id: r.id,
    product_code: r.product_code,
    product_description: r.product_description, // ✅ novo
    product_unit_id: r.product_unit_id,
    second_bar_code: r.second_bar_code,
    code_type: r.code_type,
    price_id: r.price_id,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
