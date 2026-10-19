// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsUnits.sanitizers.js — helpers base de normalização         ║
// ╚════════════════════════════════════════════════════════════════════╝

/* ──────────────────────────────────────────────────────────────────────────────
   Helpers base
───────────────────────────────────────────────────────────────────────────── */
export const notEmptyStr = (s) => typeof s === 'string' && s.trim().length > 0;
export const toNumber = (v, def = null) => (v === undefined || v === null || v === '' ? def : Number(v));
export const uniqueViolation = (err) => err && err.code === '23505';

export const normBarcode = (v) => {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const s = String(v).trim();
  if (!s) return null;
  const digits = s.replace(/\D+/g, '');
  return digits || null;
};

export function pickProductCode(obj = {}) {
  const v = obj.product_code ?? obj.product_id ?? obj.productId ?? obj.sku;
  if (!notEmptyStr(v)) return null;
  return String(v).trim();
}

export function pickProductCodeFromParams(params = {}) {
  const v =
    params.product_code ??
    params.product_id ??
    params.productId ??
    params.sku;

  return notEmptyStr(v) ? String(v).trim() : null;
}
