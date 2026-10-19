// ╔════════════════════════════════════════════════════════════════════╗
// ║ fiscalClassification.sanitizers.js — Normalização de entrada       ║
// ╚════════════════════════════════════════════════════════════════════╝

/* ──────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */
export const isFiniteNum = (v) => Number.isFinite(Number(v));
export const toNumOrNull = (v) => (isFiniteNum(v) ? Number(v) : null);
export const toBool = (v) => (typeof v === 'boolean' ? v : v === 'true' ? true : v === 'false' ? false : null);
