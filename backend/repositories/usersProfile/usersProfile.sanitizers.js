// ╔════════════════════════════════════════════════════════════════════╗
// ║ usersProfile.sanitizers.js — Normalização de entrada               ║
// ╚════════════════════════════════════════════════════════════════════╝

import { DEFAULT_PROFILE, PERMISSION_KEYS } from './usersProfile.constants.js';

export const isFiniteNum = (v) => Number.isFinite(Number(v));
export const toNum = (v) => (isFiniteNum(v) && Number(v) > 0 ? Number(v) : null);

export function toBool(value) {
  if (value === true || value === false) return value;
  if (value == null) return false;
  const v = String(value).trim().toLowerCase();
  return ['1', 'true', 't', 'yes', 'y', 'sim', 's'].includes(v);
}

/** Aceita snake_case (can_view) e camelCase (canView) */
function readFlag(item, key) {
  const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  return toBool(item[key] ?? item[camel]);
}

/**
 * Normaliza um item { modulo_id, profile, can_* } vindo da API.
 * - catalog: Map code → perfil de public."accessProfiles"
 * - Perfis fixos: flags vêm do cadastro de perfis
 * - Perfis personalizados (is_custom): flags vêm do item; incluir/editar/
 *   excluir/exportar implicam visualizar
 * Retorna { ok, data } ou { ok:false, error }.
 */
export function normalizeProfileItem(item = {}, catalog = new Map()) {
  const modulo_id = toNum(item.modulo_id ?? item.moduloId ?? item.module_id);
  if (!modulo_id) return { ok: false, error: 'modulo_id inválido.' };

  const profile = String(item.profile ?? item.profile_code ?? DEFAULT_PROFILE)
    .trim()
    .toUpperCase();

  const def = catalog.get(profile);
  if (!def) return { ok: false, error: `Perfil inválido: ${profile}.` };
  if (!def.is_active) return { ok: false, error: `O perfil ${def.name} está inativo.` };

  const permissions = {};

  if (def.is_custom) {
    PERMISSION_KEYS.forEach((k) => { permissions[k] = readFlag(item, k); });

    const anyAction = PERMISSION_KEYS.some((k) => k !== 'can_view' && permissions[k]);
    if (anyAction) permissions.can_view = true;
  } else {
    PERMISSION_KEYS.forEach((k) => { permissions[k] = Boolean(def[k]); });
  }

  return { ok: true, data: { modulo_id, profile, ...permissions } };
}
