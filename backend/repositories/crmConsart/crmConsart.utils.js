// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmConsart.utils.js — Helper de erro padronizado                   ║
// ╚════════════════════════════════════════════════════════════════════╝

export function buildError(err, context = 'crmConsartApi') {
  console.error(`[${context}]`, err);
  return {
    ok: false,
    error: err?.message || String(err),
  };
}
