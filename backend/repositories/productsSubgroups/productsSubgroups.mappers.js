// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsSubgroups.mappers.js — Linha do banco → objeto             ║
// ╚════════════════════════════════════════════════════════════════════╝

export function mapRow(r) {
  if (!r) return null;
  return {
    product_subgroup_id: r.product_subgroup_id,
    name: r.name,
    group_id: r.group_id,
    created_at: r.created_at,
    updated_at: r.updated_at,
    is_active: r.is_active,
  };
}
