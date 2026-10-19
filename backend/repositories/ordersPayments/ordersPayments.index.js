// ╔════════════════════════════════════════════════════════════════════╗
// ║ ordersPayments.index.js — ponto de entrada do módulo ordersPayments║
// ║ Mantém a mesma API pública do antigo ordersPaymentsApi.js          ║
// ╚════════════════════════════════════════════════════════════════════╝

import { listOrdersPayments, getOrderPaymentById } from './ordersPaymentsQuery.repository.js';
import { createOrderPayment } from './ordersPaymentsCreate.repository.js';
import { updateOrderPayment } from './ordersPaymentsUpdate.repository.js';
import { deleteOrderPayment } from './ordersPaymentsRemove.repository.js';

export {
  listOrdersPayments,
  getOrderPaymentById,
  createOrderPayment,
  updateOrderPayment,
  deleteOrderPayment,
};

export default {
  listOrdersPayments,
  getOrderPaymentById,
  createOrderPayment,
  updateOrderPayment,
  deleteOrderPayment,
};
