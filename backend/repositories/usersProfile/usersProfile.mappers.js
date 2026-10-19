// ╔════════════════════════════════════════════════════════════════════╗
// ║ usersProfile.mappers.js — Linha do banco → objeto de domínio       ║
// ╚════════════════════════════════════════════════════════════════════╝

import { DEFAULT_PROFILE } from './usersProfile.constants.js';

/** Linha da tabela public."usersProfile" */
export function mapRow(r = {}) {
  return {
    id: r.id,
    usuario_id: r.usuario_id,
    modulo_id: r.modulo_id,
    profile: r.profile,
    can_view: r.can_view,
    can_create: r.can_create,
    can_edit: r.can_edit,
    can_delete: r.can_delete,
    can_export: r.can_export,
    updated_by: r.updated_by,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

/**
 * Linha do LEFT JOIN moduleSystem ⇔ usersProfile.
 * Módulos sem registro aparecem com o perfil padrão (SEM_ACESSO).
 */
export function mapModuleRow(r = {}) {
  const hasProfile = r.profile_id != null;

  return {
    modulo_id: r.modulo_id,
    module_name: r.module_name,
    module_path: r.module_path,
    module_is_active: r.module_is_active,
    profile_id: r.profile_id ?? null,
    profile: hasProfile ? r.profile : DEFAULT_PROFILE,
    can_view: hasProfile ? r.can_view : false,
    can_create: hasProfile ? r.can_create : false,
    can_edit: hasProfile ? r.can_edit : false,
    can_delete: hasProfile ? r.can_delete : false,
    can_export: hasProfile ? r.can_export : false,
    updated_at: r.updated_at ?? null,
  };
}
