// ╔════════════════════════════════════════════════════════════════════╗
// ║ debtPayments.utils.js — Helpers puros (números, datas, status)     ║
// ╚════════════════════════════════════════════════════════════════════╝

export function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;

  let v = String(value)
    .trim()
    .replace(/[R$\s]/g, '');

  if (v.includes(',')) {
    v = v.replace(/\./g, '').replace(',', '.');
  }

  const num = Number(v);
  return Number.isFinite(num) ? num : fallback;
}

export function roundMoney(value) {
  return Math.round((toNumber(value, 0) + Number.EPSILON) * 100) / 100;
}

export function safeText(value, max = 255) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, max);
}

export function normalizeDate(value) {
  if (!value) return null;

  // Coluna DATE vinda do pg chega como Date (meia-noite local)
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const str = String(value).trim();
  if (!str) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  const dt = new Date(str);
  if (Number.isNaN(dt.getTime())) return null;

  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd}`;
}

export function normalizeInstallmentNumber(value) {
  if (value === null || value === undefined || value === '') return null;

  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;

  return n;
}

export function buildStatusFromDebt(debtRow) {
  const dueDate = debtRow?.due_date ? new Date(debtRow.due_date) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const openAmount = roundMoney(debtRow?.open_amount);
  const paidAmount = roundMoney(debtRow?.paid_amount);
  const updatedAmount = roundMoney(debtRow?.updated_amount);

  if (openAmount <= 0) return 'PAGO';
  if (paidAmount > 0 && openAmount > 0) return 'PARCIAL';
  if (dueDate && dueDate < today && updatedAmount > 0) return 'VENCIDO';

  return 'EM_ABERTO';
}
