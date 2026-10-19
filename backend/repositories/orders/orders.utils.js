// ╔══════════════════════════════════════════════════════════════════════╗
// ║ orders.utils.js — Helpers de pedidos                                 ║
// ║ Erros, datas, dinheiro, regra de NF-e gerada                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { NFE_STATUS } from '../../services/shared/constants/nfeStatus.js';
import { queueErrorEmail } from '../../errorEmailReporter.js';
import { ORDER_MONEY_COLUMNS, ORDER_DEFAULTS } from './orders.catalog.js';
import { ORDER_ITEM_NUMERIC_COLUMNS, ORDER_ITEM_DEFAULTS } from './ordersItems.catalog.js';

export function reportOrdersError(...args) {
  console.error(...args);
  const caught = args.find((value) => value instanceof Error);
  const label = typeof args[0] === 'string' ? args[0] : 'Erro na API de pedidos';
  queueErrorEmail('ORDERS_API_ERROR', {
    module: 'services/apis/ordersApi.js',
    message: caught?.message || label,
    context: label,
    err: caught ? { name: caught.name, message: caught.message, code: caught.code, stack: caught.stack } : undefined,
    details: args,
  });
}
// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------
export function isValidDateObj(d) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

export function parseFlexibleDate(value) {
  if (value == null || value === '') return null;

  if (value instanceof Date) {
    return isValidDateObj(value) ? value : null;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  let m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    return isValidDateObj(d) ? d : null;
  }

  m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    const [, dd, mm, yyyy, hh = '00', mi = '00', ss = '00'] = m;
    const d = new Date(`${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`);
    return isValidDateObj(d) ? d : null;
  }

  m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const [, yyyy, mm, dd] = m;
    const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    return isValidDateObj(d) ? d : null;
  }

  m = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    const [, yyyy, mm, dd, hh = '00', mi = '00', ss = '00'] = m;
    const d = new Date(`${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`);
    return isValidDateObj(d) ? d : null;
  }

  const d = new Date(raw);
  return isValidDateObj(d) ? d : null;
}

export function toPgDate(value) {
  const d = parseFlexibleDate(value);
  if (!d) return null;

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd}`;
}

export function toPgTimestamp(value) {
  const d = parseFlexibleDate(value);
  if (!d) return null;

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

export const isFiniteNum = (v) => Number.isFinite(Number(v));

export const onlyDigits = (v) => String(v ?? '').replace(/\D/g, '');
export const normUf = (v) => {
  const s = String(v ?? '').trim().toUpperCase();
  const uf = s.slice(0, 2);
  return uf ? uf : null;
};

export function round2(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

export function formatMoneyBR(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(round2(value));
}

export function safeText(value, fallback = null) {
  if (value == null) return fallback;
  const s = String(value).trim();
  return s || fallback;
}

export function formatDateBR(value) {
  const d = parseFlexibleDate(value);
  if (!d) return '—';
  return d.toLocaleDateString('pt-BR');
}

export function coalesceName(row) {
  return row.customer_name ?? row.nome_razao_social ?? null;
}

export function coalesceTaxId(row) {
  return row.customer_tax_id ?? row.cnpj_cpf ?? null;
}

// Retorna null quando o valor não é um número válido.
export function parseMoney(value) {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? Number(value.toFixed(2)) : null;
  }

  let s = String(value).trim();
  if (!s) return null;

  s = s.replace(/\s/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');

  const n = Number(s);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : null;
}

export function normalizeMoney(value, def = 0) {
  return parseMoney(value) ?? Number(def);
}

export function toNumberOr(value, def) {
  if (value === null || value === undefined || value === '') return def;
  const n = Number(value);
  return Number.isFinite(n) ? n : def;
}

export function normDiscountType(value) {
  return String(value ?? ORDER_DEFAULTS.global_discount_type).trim().toLowerCase() === 'percent'
    ? 'percent'
    : 'value';
}

export function orderMoneyFields(row) {
  return Object.fromEntries(
    ORDER_MONEY_COLUMNS.map((column) => [column, Number(row[column] || 0)]),
  );
}

export function orderItemNumericFields(row) {
  return Object.fromEntries(
    ORDER_ITEM_NUMERIC_COLUMNS.map((column) => [
      column,
      toNumberOr(row[column], ORDER_ITEM_DEFAULTS[column] ?? null),
    ]),
  );
}
// ----------------------------------------------------------------------
// ✅ Rule: "Return Order" only if NF-e was NOT generated
// ----------------------------------------------------------------------
export function hasNfeGenerated(o) {
  const key = String(o?.nfe_key || '').trim();
  const st = String(o?.nfe_status || '').trim().toUpperCase();

  const isSemNfe =
    !st ||
    st === NFE_STATUS.NONE ||
    st === 'SEM NF-E' ||
    st === 'SEM NFE';

  return (
    !!key ||
    o?.nfe_number != null ||
    !isSemNfe ||
    String(o?.nfe_plugnotas_id || '').trim() !== '' ||
    String(o?.nfe_protocol || '').trim() !== '' ||
    String(o?.nfe_xml_url || '').trim() !== '' ||
    String(o?.nfe_danfe_url || '').trim() !== ''
  );
}
