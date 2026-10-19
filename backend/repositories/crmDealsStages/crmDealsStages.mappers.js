// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmDealsStages.mappers.js — Linha do banco → objeto da etapa       ║
// ╚════════════════════════════════════════════════════════════════════╝

export function mapStageRow(row) {
  if (!row) return null;

  const isActive = row.is_active ?? true;
  const code = row.code ?? row.stage_code ?? null;
  const name = row.name ?? row.stage_name ?? null;

  return {
    id: row.id,
    name,
    code,
    stage_name: row.stage_name ?? name,
    stage_code: row.stage_code ?? code,
    color: row.color ?? '#cbd5e1',
    icon: row.icon ?? null,
    sort_order: Number(row.sort_order ?? 0),
    is_active: isActive,
    active: isActive,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}
