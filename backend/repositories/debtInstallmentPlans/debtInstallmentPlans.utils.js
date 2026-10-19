// ╔════════════════════════════════════════════════════════════════════╗
// ║ debtInstallmentPlans.utils.js — Helpers puros                      ║
// ╚════════════════════════════════════════════════════════════════════╝

export function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
