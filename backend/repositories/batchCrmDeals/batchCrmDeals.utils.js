// ╔════════════════════════════════════════════════════════════════════╗
// ║ batchCrmDeals.utils.js — Helpers de texto/número/nome do cliente   ║
// ╚════════════════════════════════════════════════════════════════════╝

export function text(value) {
  return String(value ?? '').trim();
}

export function numberOrNull(value) {
  const raw = text(value).replace(',', '.');
  if (!raw) return null;

  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function buildCustomerName(row = {}) {
  return (
    row.customer_name ||
    row.trade_name ||
    row.legal_name ||
    row.nome_fantasia ||
    row.razao_social ||
    row.name ||
    'Cliente não informado'
  );
}
