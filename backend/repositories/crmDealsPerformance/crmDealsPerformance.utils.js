// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmDealsPerformance.utils.js — Helper de erro padronizado          ║
// ╚════════════════════════════════════════════════════════════════════╝

export function buildError(err, context = 'crmDealsPerformanceApi') {
  console.error(`[${context}]`, err);
  return { ok: false, error: err?.message || String(err) };
}
