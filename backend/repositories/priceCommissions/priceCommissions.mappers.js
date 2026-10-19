// ╔════════════════════════════════════════════════════════════════════╗
// ║ priceCommissions.mappers.js — Linha do banco → objeto da API       ║
// ╚════════════════════════════════════════════════════════════════════╝

export function rowToObj(r) {
  return {
    commission_id: r.commission_id,
    price_id: r.price_id,
    price_name: r.price_name ?? null,
    seller_id: r.seller_id,
    seller_name: r.seller_name ?? null,
    commission_type: r.commission_type,
    percent_value: Number(r.percent_value || 0),
    fixed_value: Number(r.fixed_value || 0),
    active: r.active === true,
    valid_from: r.valid_from,
    valid_to: r.valid_to,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}
