// ╔════════════════════════════════════════════════════════════════════╗
// ║ cashMoviments.sanitizers.js — Normalização de entrada              ║
// ╚════════════════════════════════════════════════════════════════════╝

export function normalizeTipoMovimentacao(v) {
  if (v == null) return null;

  const raw = String(v).trim();
  if (!raw) return null;

  const up = raw
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase();

  if (up.startsWith('ENTR')) return 'ENTRADA';
  if (up.startsWith('SAID')) return 'SAIDA';

  return up;
}

export function toBool(v, def = true) {
  if (v === undefined) return def;
  if (v === null) return null;
  if (typeof v === 'boolean') return v;

  const s = String(v).trim().toLowerCase();

  if (['1', 'true', 't', 'yes', 'sim', 'y'].includes(s)) return true;
  if (['0', 'false', 'f', 'no', 'nao', 'não', 'n'].includes(s)) return false;

  return def;
}

export function toBankAccountId(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}
