// ╔══════════════════════════════════════════════════════════════════════╗
// ║ transporters.validation.js — Validações do módulo Transportadoras   ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { onlyDigits } from './transporters.utils.js';

export function validateTransporter(payload = {}) {
  const cnpj = onlyDigits(payload.tax_id);
  const cpf = onlyDigits(payload.cpf);

  if (!String(payload.legal_name || '').trim()) {
    throw new Error('A Razão Social é obrigatória.');
  }

  if (cnpj && cnpj.length !== 14) {
    throw new Error('CNPJ inválido. Informe 14 dígitos.');
  }

  if (cpf && cpf.length !== 11) {
    throw new Error('CPF inválido. Informe 11 dígitos.');
  }

  if (cnpj && cpf) {
    throw new Error('Informe CNPJ ou CPF, não os dois ao mesmo tempo.');
  }

  if (payload.state && String(payload.state).trim().length !== 2) {
    throw new Error('A UF deve conter 2 caracteres.');
  }

  return true;
}
