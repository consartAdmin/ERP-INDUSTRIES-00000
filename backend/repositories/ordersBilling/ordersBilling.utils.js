// ╔════════════════════════════════════════════════════════════════════╗
// ║ ordersBilling.utils.js — Helpers puros (datas)                     ║
// ╚════════════════════════════════════════════════════════════════════╝

// ---------------------------------------------------------------------
// Helper: normaliza data (string/Date/null) para 'YYYY-MM-DD' ou null
// ---------------------------------------------------------------------
export function normalizeDateToYMD(value) {
  if (!value) return null;

  // Se já vier como string "YYYY-MM-DD..." → corta
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }

  // Se for Date
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  // Tentativa genérica
  try {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  } catch (_) {
    // ignora
  }

  return null;
}
