// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmDeals.utils.js — Helpers puros (erro, números, diff,            ║
// ║ sellerIds[])                                                       ║
// ╚════════════════════════════════════════════════════════════════════╝

export function buildError(err, context = 'crmDealsApi') {
  console.error(`[${context}]`, err);
  return { ok: false, error: err?.message || String(err) };
}

export function isFiniteNum(v) {
  return Number.isFinite(Number(v));
}

export function toNumOrNull(v) {
  return isFiniteNum(v) ? Number(v) : null;
}

export function toPositiveNumOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function safeUpper(v) {
  return String(v || '').toUpperCase();
}

export function diffFields(before = {}, after = {}, allow = []) {
  const changed = [];
  for (const k of allow) {
    const b = before?.[k];
    const a = after?.[k];
    const same =
      (b === null || b === undefined || b === '') &&
        (a === null || a === undefined || a === '')
        ? true
        : b === a;

    if (!same) changed.push(k);
  }
  return changed;
}

export function normalizeSellerIdsArr(sellerIds) {
  if (!sellerIds) return null;

  const arr = Array.isArray(sellerIds) ? sellerIds : [sellerIds];
  const norm = arr
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0);

  return norm.length ? Array.from(new Set(norm)) : null;
}

// Empresa dona do card (coluna "crmDeals".crm_company).
// 'BH3' = CRM Gestão de Vendas original | 'CONSART' = CRM Consart ERP.
export const CRM_COMPANY_DEFAULT = 'BH3';
export const CRM_COMPANIES = ['BH3', 'CONSART'];

export function normalizeCrmCompany(v) {
  const c = String(v || '').trim().toUpperCase();
  return CRM_COMPANIES.includes(c) ? c : CRM_COMPANY_DEFAULT;
}
