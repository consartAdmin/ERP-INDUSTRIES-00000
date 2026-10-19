// ╔══════════════════════════════════════════════════════════════════════╗
// ║ priceCommissions.validation.js — Validações | PRODNEX ERP           ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export function validatePriceCommission(payload = {}) {
  if (!payload.price_id || !payload.seller_id) {
    throw new Error('Selecione a Tabela e o Vendedor.');
  }

  if (!['PERCENT', 'FIXED'].includes(payload.commission_type)) {
    throw new Error('Selecione um tipo de comissão válido.');
  }

  if (!payload.valid_from) {
    throw new Error('Informe o "Válido a partir".');
  }

  if (payload.valid_to && payload.valid_to < payload.valid_from) {
    throw new Error('A data final não pode ser anterior à data inicial.');
  }

  if (payload.commission_type === 'PERCENT' && payload.percent_value < 0) {
    throw new Error('O percentual não pode ser negativo.');
  }

  if (payload.commission_type === 'FIXED' && payload.fixed_value < 0) {
    throw new Error('O valor fixo não pode ser negativo.');
  }

  return true;
}

