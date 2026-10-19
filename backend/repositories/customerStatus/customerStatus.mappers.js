// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerStatus.mappers.js — Linha do banco → objeto da API         ║
// ╚════════════════════════════════════════════════════════════════════╝

// Normaliza linha
export const mapRow = (r) => ({
  id: r.id,
  customer_id: r.customer_id,
  status_type_id: r.status_type_id,
  note: r.note,
  updated_at: r.updated_at,
  updated_by: r.updated_by,
});

export const mapRowWithStatus = (r) => ({
  id: r.id,
  customer_id: r.customer_id,
  status_type_id: r.status_type_id,
  status_name_pt: r.status_name_pt,
  status_code: r.status_code,
  status_color_hex: r.status_color_hex,
  note: r.note,
  updated_at: r.updated_at,
  updated_by: r.updated_by,
});
