// ╔════════════════════════════════════════════════════════════════════╗
// ║ accessProfiles.mappers.js — Linha do banco → objeto de domínio     ║
// ╚════════════════════════════════════════════════════════════════════╝

import { PERMISSION_KEYS } from './accessProfiles.constants.js';

export function mapRow(r = {}) {
  const permissions = {};
  PERMISSION_KEYS.forEach((k) => { permissions[k] = Boolean(r[k]); });

  return {
    id: r.id,
    code: r.code,
    name: r.name,
    label: r.name,
    description: r.description,
    is_system: r.is_system,
    is_custom: r.is_custom,
    is_active: r.is_active,
    sort_order: r.sort_order,
    ...permissions,
    // Perfis personalizados não têm permissões fixas
    permissions: r.is_custom ? null : permissions,
    users_count: r.users_count != null ? Number(r.users_count) : undefined,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}
