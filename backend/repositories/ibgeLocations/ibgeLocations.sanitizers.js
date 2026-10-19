// ╔════════════════════════════════════════════════════════════════════╗
// ║ ibgeLocations.sanitizers.js — Conversões + normalizePayload        ║
// ╚════════════════════════════════════════════════════════════════════╝

/* =======================================================================
 * Helpers básicos
 * ======================================================================= */
export const isFiniteNum = (v) => {
  if (v === '' || v == null) return false;
  const n = Number(String(v).trim().replace(',', '.'));
  return Number.isFinite(n);
};

export const toNumOrNull = (v) =>
  isFiniteNum(v) ? Number(String(v).trim().replace(',', '.')) : null;

export const toTrimOrNull = (v) =>
  v == null ? null : (String(v).trim() || null);

export const toBoolOrNull = (v) => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  if (['1', 'true', 't', 'sim', 'yes', 'y', 'ativo', 'active'].includes(s)) return true;
  if (['0', 'false', 'f', 'nao', 'não', 'no', 'n', 'inativo', 'inactive'].includes(s)) return false;
  return null;
};

export const toState2 = (v) => {
  const s = toTrimOrNull(v);
  if (!s) return null;
  const out = String(s).trim().toUpperCase();
  return out.slice(0, 2);
};

export const toInt = (v, fallback = 0) => {
  if (v == null || v === '') return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.trunc(n));
};

/* =======================================================================
 * Normalização de payload
 * ======================================================================= */
export function normalizePayload(payload = {}) {
  const state =
    payload.state ??
    payload.uf ??
    payload.estado ??
    payload.sigla ??
    null;

  const city =
    payload.city ??
    payload.cidade ??
    payload.municipio ??
    payload.mun ??
    null;

  const ibge_code =
    toNumOrNull(payload.ibge_code ?? payload.ibgeCode ?? payload.codigo_ibge ?? payload.codigoIBGE);

  let status = toBoolOrNull(payload.status);
  if (status === null && payload.active != null) status = toBoolOrNull(payload.active);
  if (status === null) status = true;

  return {
    state: toState2(state),
    city: toTrimOrNull(city),
    ibge_code: ibge_code,
    status: status,
  };
}
