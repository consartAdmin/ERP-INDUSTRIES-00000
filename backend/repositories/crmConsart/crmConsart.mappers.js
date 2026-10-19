// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmConsart.mappers.js — Linha do banco → stage / deal              ║
// ╚════════════════════════════════════════════════════════════════════╝

export function mapStageRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    color: row.color,
    sort_order: row.sort_order,
    active: row.active,
    created_at: row.created_at,
    updated_at: row.updated_at,
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
    tag: row.tag,
    next_step: row.next_step,
    last_activity_date: row.last_activity_date,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
