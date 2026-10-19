// ╔════════════════════════════════════════════════════════════════════╗
// ║ modulePasswords.mappers.js — Linha do banco → objeto da API        ║
// ║ ⚠️ Nunca devolve o password_hash.                                   ║
// ╚════════════════════════════════════════════════════════════════════╝

export const mapRow = (r) => ({
  module_password_id: r.module_password_id,
  module_code: r.module_code,
  action_code: r.action_code,
  description: r.description,
  has_password: Boolean(r.password_hash),
  is_active: r.is_active,
  updated_by: r.updated_by,
  created_at: r.created_at,
  updated_at: r.updated_at,
});
