// ╔══════════════════════════════════════════════════════════════════════╗
// ║ enterprise.validation.js                                            ║
// ║ Validações do formulário de Empresas                               ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { onlyDigits } from './enterprise.utils.js';

function isValidEmail(value) {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validateEnterprisePayload(payload) {
  const errors = [];

  if (!payload.corporate_name) {
    errors.push('Informe a razão social.');
  }

  if (onlyDigits(payload.cnpj).length !== 14) {
    errors.push('Informe um CNPJ com 14 dígitos.');
  }

  if (payload.state && payload.state.length !== 2) {
    errors.push('UF deve conter exatamente 2 caracteres.');
  }

  if (!isValidEmail(payload.email)) {
    errors.push('Informe um e-mail válido.');
  }

  if (!Number.isSafeInteger(payload.next_nfe_number) || payload.next_nfe_number < 1) {
    errors.push('O próximo número da NF-e deve ser um inteiro maior ou igual a 1.');
  }

  if (errors.length) {
    throw new Error(errors[0]);
  }

  return true;
}
