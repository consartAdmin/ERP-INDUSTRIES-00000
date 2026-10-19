// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerStatusTypes.mappers.js — Linha do banco → objeto da API    ║
// ╚════════════════════════════════════════════════════════════════════╝

// Normaliza linha completa
export const mapRow = (r) => ({
  id: r.id,
  name_pt: r.name_pt,
  internal_code: r.internal_code,
  description_en: r.description_en,
  color_hex: r.color_hex,
  sort_order: r.sort_order,
  is_active: r.is_active,
});

// Projeção leve para dropdowns/combos
export const mapSearchRow = (r) => ({
  id: r.id,
  name_pt: r.name_pt,
  internal_code: r.internal_code,
  color_hex: r.color_hex,
});
