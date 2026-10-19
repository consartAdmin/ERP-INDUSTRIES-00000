// ╔══════════════════════════════════════════════════════════════════════╗
// ║ suppliers.sanitizers.js — helpers de normalização                    ║
// ║ Inclui montagem do campo legado address                              ║
// ╚══════════════════════════════════════════════════════════════════════╝

/* ──────────────────────────────────────────────────────────────
   Helpers de normalização
────────────────────────────────────────────────────────────── */
export function cleanString(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const str = String(value).trim();
  return str === '' ? null : str;
}

export function cleanPositiveInteger(value) {
  if (value === undefined) return undefined;
  if (value === null || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

export function normalizeState(value) {
  const str = cleanString(value);
  return str ? str.toUpperCase().slice(0, 2) : str;
}

export function buildLegacyAddress(data = {}) {
  const street = [cleanString(data.address_street_type), cleanString(data.address_street)]
    .filter(Boolean)
    .join(' ');

  const parts = [
    street,
    cleanString(data.address_number),
    cleanString(data.address_complement),
    cleanString(data.address_district),
  ].filter(Boolean);

  return parts.length ? parts.join(', ') : null;
}
