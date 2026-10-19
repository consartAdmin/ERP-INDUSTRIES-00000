// ╔════════════════════════════════════════════════════════════════════╗
// ║ debtPayments.index.js — ponto de entrada do módulo pagamentos      ║
// ║ Mantém a mesma API pública do antigo debtPaymentsApi.js            ║
// ╚════════════════════════════════════════════════════════════════════╝

import { listByDebtId, getById, getSummaryByDebtId } from './debtPaymentsQuery.repository.js';
import { createPayment } from './debtPaymentsCreate.repository.js';
import { deletePayment } from './debtPaymentsRemove.repository.js';
import { updatePayment } from './debtPaymentsUpdate.repository.js';
import { getDebtCashDefaults, getDebtPaymentCash } from './debtPaymentsCashMovement.repository.js';

export default {
  listByDebtId,
  getById,
  createPayment,
  updatePayment,
  deletePayment,
  getSummaryByDebtId,
  getDebtCashDefaults,
  getDebtPaymentCash
};
