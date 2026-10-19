// ╔════════════════════════════════════════════════════════════════════╗
// ║ fixedExpenses.sanitizers.js — Normalização do payload JSONB        ║
// ╚════════════════════════════════════════════════════════════════════╝

/** Normaliza payload JSONB */
export function normalizePayload(payload) {
  if (payload === undefined || payload === null || payload === '') return {};
  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    if (!trimmed) return {};
    try { return JSON.parse(trimmed); } catch { /* retorna string bruta */ }
  }
  return payload;
}
