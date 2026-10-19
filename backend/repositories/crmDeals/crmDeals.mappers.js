// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmDeals.mappers.js — Linha do banco → stage / deal                ║
// ╚════════════════════════════════════════════════════════════════════╝

/* =========================================================================
 * MAPPERS
 * ========================================================================= */
export function mapStageRow(row) {
  if (!row) return null;

  const isActive = row.is_active ?? true;

  return {
    id: row.id,
    code: row.code ?? row.stage_code ?? null,
    name: row.name ?? row.stage_name ?? null,
    stage_name: row.stage_name ?? row.name ?? null,
    stage_code: row.stage_code ?? row.code ?? null,
    color: row.color ?? null,
    icon: row.icon ?? null,
    sort_order: row.sort_order ?? 0,
    active: isActive,
    is_active: isActive,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

export function mapDealRow(row) {
  if (!row) return null;

  return {
    id: row.id,

    stage_id: row.stage_id,
    stage_code: row.stage_code,
    stage_name: row.stage_name,

    customer_id: row.customer_id,
    customer_name: row.customer_name,

    seller_id: row.seller_id,
    seller_name: row.seller_name,

    estimated_value: row.estimated_value,

    lead_source_id: row.lead_source_id ?? null,
    lead_source_name: row.lead_source_name ?? null,

    status_type_id: row.status_type_id ?? null,
    status_name_pt: row.status_name_pt ?? null,
    status_code: row.status_code ?? null,
    status_color_hex: row.status_color_hex ?? null,

    outcome: row.outcome ?? null,
    outcome_at: row.outcome_at ?? null,
    outcome_id: row.outcome_id ?? null,
    outcome_name: row.outcome_name ?? null,
    outcome_code: row.outcome_code ?? null,

    loss_reason_id: row.loss_reason_id ?? null,
    loss_reason_name: row.loss_reason_name ?? null,
    loss_notes: row.loss_notes ?? null,

    tag: row.tag,
    next_step: row.next_step,
    last_activity_date: row.last_activity_date,
    notes: row.notes,

    is_closed: row.is_closed ?? false,
    crm_company: row.crm_company ?? 'BH3',

    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
