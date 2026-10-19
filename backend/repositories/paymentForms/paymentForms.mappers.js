// ╔════════════════════════════════════════════════════════════════════╗
// ║ paymentForms.mappers.js — Linha do banco → objeto                  ║
// ╚════════════════════════════════════════════════════════════════════╝

export function mapRow(row = {}) {
  if (!row) return null;

  return {
    paymentForms_id: row.paymentForms_id,
    name: row.name,
    nfe_tpag: row.nfe_tpag,
    active: row.active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
