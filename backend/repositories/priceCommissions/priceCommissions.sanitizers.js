// ╔════════════════════════════════════════════════════════════════════╗
// ║ priceCommissions.sanitizers.js — Normalização de entrada           ║
// ╚════════════════════════════════════════════════════════════════════╝

// ======================================================================
// Helpers
// ======================================================================
export const isFiniteNum = (v) => Number.isFinite(Number(v));
export const clamp0 = (n) => (n < 0 ? 0 : n);

export function normType(t) {
  const s = String(t || '').toUpperCase().trim();
  return (s === 'FIXED' || s === 'PERCENT') ? s : 'PERCENT';
}

export function normalizeIn(body = {}) {
  const out = {
    price_id: Number(body.price_id),
    seller_id: Number(body.seller_id),
    commission_type: normType(body.commission_type),
    percent_value: isFiniteNum(body.percent_value) ? clamp0(Number(body.percent_value)) : 0,
    fixed_value: isFiniteNum(body.fixed_value) ? clamp0(Number(body.fixed_value)) : 0,
    active: body.active === false ? false : true,
    valid_from: body.valid_from || new Date().toISOString().slice(0, 10),
    valid_to: body.valid_to || null,
  };

  if (!Number.isFinite(out.price_id) || out.price_id <= 0) throw new Error('price_id inválido');
  if (!Number.isFinite(out.seller_id) || out.seller_id <= 0) throw new Error('seller_id inválido');

  // coerência
  if (out.commission_type === 'PERCENT') out.fixed_value = 0;
  else out.percent_value = 0;

  return out;
}
