// ╔══════════════════════════════════════════════════════════════════════╗
// ║ plugnotasNfce.mappers.js — Normalização do retorno do /resumo        ║
// ╚══════════════════════════════════════════════════════════════════════╝

/* ------------------------------------------------------------------ */
/* Normalização do retorno do /resumo (às vezes array, às vezes obj)  */
/* ------------------------------------------------------------------ */

export function normalizeResumoResponse(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') return [data];
  return [];
}
