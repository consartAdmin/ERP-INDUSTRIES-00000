// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeReceiptsList.validation.js — Regras dos filtros de pesquisa      ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { STATUS_LABELS } from './nfeReceiptsList.config.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Valida os filtros antes de consultar a API.
 * Retorna uma mensagem de erro ou null quando está tudo certo.
 */
export function validateFilters({ status, dateFrom, dateTo } = {}) {
  if (status && !Object.hasOwn(STATUS_LABELS, status)) {
    return 'Status inválido.';
  }

  if (dateFrom && !ISO_DATE.test(dateFrom)) {
    return 'Data inicial inválida.';
  }

  if (dateTo && !ISO_DATE.test(dateTo)) {
    return 'Data final inválida.';
  }

  if (dateFrom && dateTo && dateFrom > dateTo) {
    return 'A data inicial não pode ser maior que a data final.';
  }

  return null;
}
