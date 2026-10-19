// ╔════════════════════════════════════════════════════════════════════╗
// ║ fiscalClassification.mappers.js — Linha do banco → objeto da API   ║
// ╚════════════════════════════════════════════════════════════════════╝

export const normalizeRow = (r = {}) => ({
  fiscal_classification_id: r.fiscal_classification_id,
  classification_name: r.classification_name ?? null,
  description: r.description ?? null,

  // atuais
  ncm_code: r.ncm_code ?? null,
  cest_code: r.cest_code ?? null,
  ncm_description: r.ncm_description ?? null,
  cest_description: r.cest_description ?? null,
  fiscal_profile_id: r.fiscal_profile_id ?? null,
  fiscal_profile_name: r.fiscal_profile_name ?? r.profile_name ?? null,

  is_active: r.is_active ?? true,
  created_at: r.created_at ?? null,
  updated_at: r.updated_at ?? null,

  // 🔁 aliases p/ frontend legado
  ncm: r.ncm_code ?? null,
  cest: r.cest_code ?? null,
  profile_id: r.fiscal_profile_id ?? null,
  profile_name: r.fiscal_profile_name ?? r.profile_name ?? null
});
