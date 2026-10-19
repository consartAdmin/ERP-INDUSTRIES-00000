// ╔════════════════════════════════════════════════════════════════════╗
// ║ googleAdsCampaignDetails.utils.js — Helpers puros (datas, GAQL)    ║
// ╚════════════════════════════════════════════════════════════════════╝

// ---------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------
export function toYmd(d) {
  return String(d || '').slice(0, 10);
}

export function escGaqlString(v) {
  return String(v ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export function safeInt(v, fallback = NaN) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export function microsToMoney(micros) {
  return Number(micros || 0) / 1_000_000;
}

export function normDigits(v) {
  return String(v || '').replace(/[^0-9]/g, '').trim();
}

export function daysBetweenYmd(aYmd, bYmd) {
  const a = new Date(`${aYmd}T00:00:00Z`).getTime();
  const b = new Date(`${bYmd}T00:00:00Z`).getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

export function addDaysYmd(ymd, days) {
  const t = new Date(`${ymd}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + Number(days || 0));
  return t.toISOString().slice(0, 10);
}

// helper: pega campo do row tanto camelCase quanto snake_case
export function pick(obj, camel, snake) {
  if (!obj) return undefined;
  if (obj[camel] !== undefined) return obj[camel];
  if (snake && obj[snake] !== undefined) return obj[snake];
  return undefined;
}

export function pickNested(row, camelRoot, snakeRoot) {
  return pick(row, camelRoot, snakeRoot);
}
