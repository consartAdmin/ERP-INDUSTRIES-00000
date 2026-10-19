// Payment Methods — form validation

'use strict';

import { GAP_FIELDS } from './paymentMethods.config.js';

export function validatePaymentMethod(payload) {
  const errors = [];

  if (!payload.name) errors.push('Informe o nome.');
  if (!payload.type) errors.push('Selecione o tipo.');
  if (!Number.isInteger(payload.installments) || payload.installments < 1 || payload.installments > 10) {
    errors.push('Parcelas deve ser um inteiro entre 1 e 10.');
  }

  if (payload.nfe_tpag && !/^\d{2}$/.test(payload.nfe_tpag)) {
    errors.push('Cód. NF-e tPag deve possuir exatamente dois dígitos.');
  }

  for (const field of GAP_FIELDS) {
    if (!Number.isInteger(payload[field]) || payload[field] < 0) {
      errors.push(`${field} deve ser um inteiro não negativo.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
