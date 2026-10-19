// ╔════════════════════════════════════════════════════════════════════╗
// ║ userModules.sanitizers.js — Helpers numéricos                      ║
// ╚════════════════════════════════════════════════════════════════════╝

export const isFiniteNum = (v) => Number.isFinite(Number(v));
export const toNum = (v) => (isFiniteNum(v) ? Number(v) : null);
