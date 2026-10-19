// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmLossReasons.mappers.js — Linha do banco → objeto da API         ║
// ╚════════════════════════════════════════════════════════════════════╝

export function mapRow(r) {
  if (!r) return null;

  return {
    id: r.id ?? null,
    reason_name: r.reason_name ?? null,
    is_active: r.is_active ?? true,
    created_at: r.created_at ?? null,
    reason_label: r.reason_name ?? null
  };
}
