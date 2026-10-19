// ╔════════════════════════════════════════════════════════════════════╗
// ║ debts.utils.js — Helpers puros (números, datas, status, paginação) ║
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

export function normalizeMonth(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : null;
}

export function normalizeYear(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 2000 && n <= 9999 ? n : null;
}

export function computeUpdatedAmount({
  original_amount = 0,
  interest_amount = 0,
  fine_amount = 0,
  discount_amount = 0
}) {
  return roundMoney(
    roundMoney(original_amount) +
    roundMoney(interest_amount) +
    roundMoney(fine_amount) -
    roundMoney(discount_amount)
  );
}

export function computeOpenAmount(updatedAmount, paidAmount) {
  return roundMoney(Math.max(roundMoney(updatedAmount) - roundMoney(paidAmount), 0));
}

export function computeStatus({ due_date, paid_amount, open_amount }) {
  const open = roundMoney(open_amount);
  const paid = roundMoney(paid_amount);

  if (open <= 0) return 'PAGO';
  if (paid > 0 && open > 0) return 'PARCIAL';

  if (due_date) {
    const due = new Date(due_date);
    due.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (due < today && open > 0) return 'VENCIDO';
  }

  return 'EM_ABERTO';
}

export function normalizePaging(page = 1, limit = 20) {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 200);
  const offset = (safePage - 1) * safeLimit;

  return { safePage, safeLimit, offset };
}

export function buildFirstDueDateFromIssue(issueDateValue, dueDayValue) {
  const issueDate = normalizeDate(issueDateValue);
  const dueDay = Number(dueDayValue);

  if (!issueDate || !Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
    return null;
  }

  const base = new Date(`${issueDate}T00:00:00`);
  const year = base.getFullYear();
  const month = base.getMonth() + 1;

  const lastDay = new Date(year, month, 0).getDate();
  const safeDay = Math.min(dueDay, lastDay);

  let dueDate = new Date(year, month - 1, safeDay);

  if (dueDate < base) {
    const nextMonthRaw = month + 1;
    const nextYear = nextMonthRaw > 12 ? year + 1 : year;
    const nextMonth = nextMonthRaw > 12 ? 1 : nextMonthRaw;
    const nextLastDay = new Date(nextYear, nextMonth, 0).getDate();

    dueDate = new Date(nextYear, nextMonth - 1, Math.min(dueDay, nextLastDay));
  }

  return `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(
    dueDate.getDate()
  ).padStart(2, '0')}`;
}

// Obs.: não utilizada no módulo original (mantida como estava).
export function buildDueDate(year, month, day) {
  const lastDay = new Date(year, month, 0).getDate();

  return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(
    2,
    '0'
  )}`;
}
