// ╔═══════════════════════════════════════════════════════════════════════╗
// ║ nfeBonusIssued.sanitizers.js — NF-e Bonificação                       ║
// ║ Normalização de texto, inteiros, decimais, dinheiro e usuário         ║
// ╚═══════════════════════════════════════════════════════════════════════╝

// ======================================================================
// HELPERS
// ======================================================================

export function normalizeText(value, def = null) {
  if (value === undefined || value === null) return def;

  const s = String(value).trim();

  return s || def;
}


export function normalizeInteger(value, def = null) {
  if (value === undefined || value === null || value === '') {
    return def;
  }

  const n = Number(value);

  return Number.isSafeInteger(n)
    ? n
    : def;
}


export function normalizePositiveInteger(value, def = null) {
  const n = normalizeInteger(value, def);

  return Number.isSafeInteger(n) && n > 0
    ? n
    : def;
}


export function normalizeDecimal(value, def = 0, decimals = 3) {
  const n = Number(value ?? def);

  if (!Number.isFinite(n)) {
    return Number(def);
  }

  return Number(n.toFixed(decimals));
}


export function normalizeMoney(value, def = 0) {
  return normalizeDecimal(value, def, 2);
}


export function normalizeUserId(value) {
  const id = Number(value);

  return Number.isSafeInteger(id) && id > 0
    ? id
    : null;
}
