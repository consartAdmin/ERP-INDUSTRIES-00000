// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: customerRegistration.validation.js                            ║
// ║ MODULE: Customer Registration — Validation                          ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export function validateCustomerPayload(payload) {
  const isPF = payload?.person_type === 'F' || payload?.customer_type === 'F';

  if (isPF) {
    if (!payload.trade_name && !payload.legal_name) return 'Informe o Nome Completo.';
    if (String(payload.tax_id || '').length !== 11) return 'Informe um CPF com 11 dígitos.';
    return null;
  }

  if (!payload.trade_name) return 'Informe o Nome Fantasia.';
  if (!payload.legal_name) return 'Informe a Razão Social.';
  if (String(payload.tax_id || '').length !== 14) return 'Informe um CNPJ com 14 dígitos.';
  return null;
}

export function isValidCnpjDigits(cnpj) {
  return /^\d{14}$/.test(String(cnpj || ''));
}
