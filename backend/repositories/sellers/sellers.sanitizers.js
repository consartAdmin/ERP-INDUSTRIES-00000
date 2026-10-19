// ╔════════════════════════════════════════════════════════════════════╗
// ║ sellers.sanitizers.js — Helpers básicos + normalizePayload         ║
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

/* =======================================================================
* Normalização de payload
* ======================================================================= */
export function normalizePayload(payload = {}) {
  const name =
    payload.name ??
    payload.nome ??
    payload.seller_name ??
    null;

  const nickname =
    payload.nickname ??
    payload.apelido ??
    null;

  const document =
    payload.document ??
    payload.cpf_cnpj ??
    payload.cnpj_cpf ??
    null;

  const email =
    payload.email ??
    payload.mail ??
    null;

  const phone =
    payload.phone ??
    payload.telefone ??
    null;

  const mobile =
    payload.mobile ??
    payload.celular ??
    payload.phone_mobile ??
    null;

  const commission_type =
    payload.commission_type ??
    payload.tipo_comissao ??
    'PERCENT';

  const commission_value =
    toNumOrNull(payload.commission_value ?? payload.comissao ?? payload.commission);

  let active = toBoolOrNull(payload.active);
  if (active === null && payload.status != null) {
    const s = String(payload.status).toLowerCase();
    active = ['ativo', 'active', '1', 'true'].includes(s);
  }

  return {
    name:             toTrimOrNull(name),
    nickname:         toTrimOrNull(nickname),
    document:         toTrimOrNull(document),
    email:            toTrimOrNull(email),
    phone:            toTrimOrNull(phone),
    mobile:           toTrimOrNull(mobile),
    active:           active ?? true,
    commission_type:  toTrimOrNull(commission_type || 'PERCENT'),
    commission_value: commission_value ?? 0,
    observations:     toTrimOrNull(payload.observations ?? payload.obs ?? payload.observacao),
  };
}
