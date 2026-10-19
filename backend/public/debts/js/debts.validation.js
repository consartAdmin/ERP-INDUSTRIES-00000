'use strict';

export function validateDebtPayload(payload = {}) {
  if (!payload.description) throw new Error('Informe a descrição da dívida.');
  if (!payload.debt_type) throw new Error('Selecione o tipo da dívida.');
  if (!payload.due_day) throw new Error('Informe o dia de vencimento.');
  if (Number(payload.original_amount || 0) <= 0) {
    throw new Error('O valor original deve ser maior que zero.');
  }

  return true;
}
