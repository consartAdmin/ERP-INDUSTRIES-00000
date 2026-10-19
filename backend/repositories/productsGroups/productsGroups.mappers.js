// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsGroups.mappers.js — Linha do banco → objeto da API         ║
// ╚════════════════════════════════════════════════════════════════════╝

export function mapRow(r) {
  if (!r) return null;
  return {
    product_group_id: r.product_group_id,
    name: r.name,
    created_at: r.created_at,
    updated_at: r.updated_at,
    is_active: r.is_active,
  };
}
