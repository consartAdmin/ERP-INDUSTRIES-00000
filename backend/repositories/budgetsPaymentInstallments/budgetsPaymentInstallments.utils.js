// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsPaymentInstallments.utils.js — datas e divisão de valores     ║
// ║ toDateOnly / addDays / todayInSaoPaulo / splitAmount / gaps          ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  toInt,
  toNumber,
} from './budgetsPaymentInstallments.sanitizers.js';

/*
 * O driver pg devolve colunas DATE como Date na meia-noite LOCAL.
 * toISOString() converteria para UTC e, num servidor com fuso positivo,
 * voltaria um dia; por isso Date usa os componentes locais.
 */
export function toDateOnly(value) {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, '0');
    const dd = String(value.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  const asString = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(asString)) return asString;

  const dt = new Date(asString);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

/*
 * Aritmética de datas inteiramente em UTC: sem o "Z" a data-base era lida
 * no fuso do servidor e podia deslocar um dia fora de UTC-3.
 */
export function addDays(dateInput, days = 0) {
  const base = new Date(`${toDateOnly(dateInput)}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) return null;
  base.setUTCDate(base.getUTCDate() + Number(days || 0));
  return base.toISOString().slice(0, 10);
}

export function todayInSaoPaulo() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

export function splitAmount(total, parts) {
  const totalCents = Math.round(toNumber(total, 0) * 100);
  const qty = Math.max(toInt(parts, 1) || 1, 1);

  const base = Math.floor(totalCents / qty);
  let remainder = totalCents - (base * qty);

  const result = [];
  for (let i = 0; i < qty; i += 1) {
    const cents = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    result.push(Number((cents / 100).toFixed(2)));
  }

  return result;
}

export function normalizeInstallmentsCount(methodRow) {
  const raw = toInt(methodRow?.installments, 1) || 1;
  return Math.max(raw, 1);
}

export function extractGaps(methodRow, installmentsCount) {
  const gaps = [
    toInt(methodRow?.gap_one, 0) || 0,
    toInt(methodRow?.gap_two, 0) || 0,
    toInt(methodRow?.gap_three, 0) || 0,
    toInt(methodRow?.gap_four, 0) || 0,
    toInt(methodRow?.gap_five, 0) || 0,
    toInt(methodRow?.gap_six, 0) || 0,
    toInt(methodRow?.gap_seven, 0) || 0,
    toInt(methodRow?.gap_eight, 0) || 0,
    toInt(methodRow?.gap_nine, 0) || 0,
    toInt(methodRow?.gap_ten, 0) || 0
  ];

  const normalized = [];

  for (let i = 0; i < installmentsCount; i += 1) {
    normalized.push(gaps[i] ?? 0);
  }

  if (normalized.length === 0) {
    normalized.push(0);
  }

  return normalized;
}
