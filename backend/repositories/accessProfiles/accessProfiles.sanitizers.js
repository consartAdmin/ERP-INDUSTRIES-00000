// ╔════════════════════════════════════════════════════════════════════╗
// ║ accessProfiles.sanitizers.js — Normalização de entrada             ║
// ╚════════════════════════════════════════════════════════════════════╝

import { CODE_MAX_LENGTH, PERMISSION_KEYS } from './accessProfiles.constants.js';

export const toNum = (v) =>
  Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null;

export function toBool(value) {
  if (value === true || value === false) return value;
  if (value == null) return false;
  const v = String(value).trim().toLowerCase();
  return ['1', 'true', 't', 'yes', 'y', 'sim', 's'].includes(v);
}

/** "Vendedor Externo" → "VENDEDOR_EXTERNO" */
export function toCode(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, CODE_MAX_LENGTH);
}

/** Aceita snake_case (can_view) e camelCase (canView) */
function readFlag(body, key) {
  const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  const v = body[key] ?? body[camel];
  return v === undefined ? undefined : toBool(v);
}

/**
 * Normaliza o corpo de create/update.
 * - partial=false (create): exige name; gera code a partir do name se não vier
 * - partial=true  (update): só devolve o que veio
 * - Qualquer ação marcada implica can_view
 */
export function normalizePayload(body = {}, { partial = false } = {}) {
  const out = {};

  if (body.name !== undefined || !partial) {
    const name = String(body.name ?? '').trim();
    if (!name) return { ok: false, error: 'Informe o nome do perfil.' };
    if (name.length > 80) return { ok: false, error: 'O nome deve ter no máximo 80 caracteres.' };
    out.name = name;
  }

  if (!partial) {
    out.code = toCode(body.code || out.name);
    if (!out.code) return { ok: false, error: 'Não foi possível gerar o código do perfil.' };
  }

  if (body.description !== undefined) {
    out.description = String(body.description ?? '').trim().slice(0, 255) || null;
  }

  const isActive = body.is_active ?? body.isActive;
  if (isActive !== undefined) out.is_active = toBool(isActive);
  else if (!partial) out.is_active = true;

  const sortOrder = body.sort_order ?? body.sortOrder;
  if (sortOrder !== undefined && sortOrder !== '') {
    const n = parseInt(sortOrder, 10);
    if (Number.isNaN(n)) return { ok: false, error: 'Ordem inválida.' };
    out.sort_order = n;
  } else if (!partial) {
    out.sort_order = 100;
  }

  PERMISSION_KEYS.forEach((k) => {
    const v = readFlag(body, k);
    if (v !== undefined) out[k] = v;
    else if (!partial) out[k] = false;
  });

  const anyAction = PERMISSION_KEYS.some((k) => k !== 'can_view' && out[k]);
  if (anyAction) out.can_view = true;

  return { ok: true, data: out };
}
