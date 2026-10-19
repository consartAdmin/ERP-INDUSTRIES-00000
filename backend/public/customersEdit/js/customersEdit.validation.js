// ╔══════════════════════════════════════════════════════════════════════╗
// ║ customersEdit.validation.js — Validações | PRODNEX ERP              ║
// ╚══════════════════════════════════════════════════════════════════════╝
'use strict';

function isValidEmail(value) {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

export function validateFinancialContact(payload = {}) {
  const emailFields = [
    ['financial_contact_email', 'E-mail do contato financeiro'],
    ['billing_email', 'E-mail para cobranças'],
    ['invoice_email', 'E-mail para NF-e'],
  ];

  for (const [field, label] of emailFields) {
    if (!isValidEmail(payload[field])) return { ok: false, message: `${label} inválido.` };
  }
  return { ok: true };
}
