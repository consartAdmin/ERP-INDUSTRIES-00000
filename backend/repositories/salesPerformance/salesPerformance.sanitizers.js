// ╔════════════════════════════════════════════════════════════════════╗
// ║ salesPerformance.sanitizers.js — Datas e lista de responsáveis     ║
// ╚════════════════════════════════════════════════════════════════════╝

/* ======================================================================
   HELPERS
   ====================================================================== */

export function isValidDateString(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '').trim());
}

export function normalizeDateRange(inicio, fim) {
  return {
    inicio: isValidDateString(inicio) ? `${inicio} 00:00:00` : null,
    fim: isValidDateString(fim) ? `${fim} 23:59:59.999` : null
  };
}

export function splitResponsaveis(raw) {
  const arr = Array.isArray(raw)
    ? raw
    : raw != null && raw !== ''
      ? [raw]
      : [];

  const values = arr
    .flatMap((v) => String(v).split(','))
    .map((v) => v.trim())
    .filter(Boolean);

  const ids = [];
  const nomes = [];

  for (const item of values) {
    if (/^\d+$/.test(item)) ids.push(Number(item));
    else nomes.push(item.toUpperCase());
  }

  return { ids, nomes };
}
