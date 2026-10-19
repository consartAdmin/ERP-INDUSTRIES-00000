// ╔════════════════════════════════════════════════════════════════════╗
// ║ accountsReceivable.sanitizers.js — Validação/normalização          ║
// ║ IDs (ERP/Asaas/banco), inteiros e filtro de status                 ║
// ╚════════════════════════════════════════════════════════════════════╝

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------
export function isAsaasCustomerId(v) {
  return /^cus_/i.test(String(v ?? '').trim());
}

export function normalizeErpCustomerId(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function toInt(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function normalizeBankAccountId(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

export function normalizeStatusFilter(value) {
  const status = String(value || '').trim().toUpperCase();

  const aliases = {
    PENDENTE: 'PENDING',
    PAGO: 'PAID',
    VENCIDO: 'OVERDUE',
    PARCIAL: 'PARTIAL',
    CANCELADO: 'CANCELLED',
    CANCELED: 'CANCELLED',
  };

  return aliases[status] || status;
}
