// ╔════════════════════════════════════════════════════════════════════╗
// ║ OrdersLogisticsPacking.utils.js — Conversões e respostas HTTP      ║
// ╚════════════════════════════════════════════════════════════════════╝

export const isFiniteNum = (v) => Number.isFinite(Number(v));
export const toNum = (v, def = 0) => (isFiniteNum(v) ? Number(v) : def);
export const toInt = (v) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};

export function ok(res, data = {}) {
  return res.json({ ok: true, ...data });
}
export function bad(res, msg, code = 400, extra = {}) {
  return res.status(code).json({ ok: false, error: msg, ...extra });
}
