// ╔════════════════════════════════════════════════════════════════════╗
// ║ bankAccountsBalance.utils.js — Helpers puros (data de hoje, número)║
// ╚════════════════════════════════════════════════════════════════════╝

export function todayIso() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function num(value) {
  return value === null || value === undefined ? null : Number(value);
}
