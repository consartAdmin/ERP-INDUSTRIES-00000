// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmDealsStages.sql.js — SELECT base de public."crmDealsStages"     ║
// ╚════════════════════════════════════════════════════════════════════╝

export function buildStageSelectSql() {
  return `
    SELECT
      s.id,
      s.stage_name AS name,
      COALESCE(s.code, s.stage_code) AS code,
      s.stage_name,
      s.stage_code,
      s.color,
      s.icon,
      s.sort_order,
      COALESCE(s.is_active, TRUE) AS is_active,
      s.created_at,
      s.updated_at
    FROM public."crmDealsStages" s
  `;
}
