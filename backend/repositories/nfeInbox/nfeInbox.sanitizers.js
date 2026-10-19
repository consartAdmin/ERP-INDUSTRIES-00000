// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeInbox.sanitizers.js — Normalização de entrada (dígitos, números)  ║
// ╚══════════════════════════════════════════════════════════════════════╝

// ======================================================================
// Helpers
// ======================================================================
export function onlyDigits(v) {
  return String(v || '').replace(/\D/g, '');
}

/** CNPJ normalizado: 14 dígitos ou null (evita estourar VARCHAR(14)). */
export function cnpj14(v) {
  const d = onlyDigits(v);
  return d.length === 14 ? d : null;
}

/**
 * Number seguro: nunca devolve NaN.
 * NUMERIC do Postgres ACEITA 'NaN' como valor válido — sem esta guarda um
 * valor_total malformado entra no banco e contamina todo SUM() futuro.
 * BIGINT rejeita NaN e quebraria o INSERT em runtime.
 */
export function toNumber(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Escapa os metacaracteres de LIKE/ILIKE.
 * Sem isso, buscar "100%" casa com tudo e "a_b" casa com "axb".
 * Sempre usar junto de ESCAPE '\' na query.
 */
export function escapeLike(s) {
  return String(s).replace(/[\\%_]/g, (c) => '\\' + c);
}
