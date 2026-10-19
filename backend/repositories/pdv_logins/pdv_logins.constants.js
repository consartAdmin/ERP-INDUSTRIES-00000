// ╔══════════════════════════════════════════════════════════════════════╗
// ║ pdv_logins.constants.js — Tabela, perfis e colunas seguras           ║
// ╚══════════════════════════════════════════════════════════════════════╝

export const TABLE = 'public.pdv_logins';
export const DEFAULT_ROLE = 'operator';
export const ALLOWED_ROLES = new Set(['operator', 'supervisor', 'admin']);
export const BCRYPT_ROUNDS = 12;

export const SAFE_COLUMNS = `
  id,
  username,
  full_name,
  role,
  active,
  created_at,
  updated_at
`;
