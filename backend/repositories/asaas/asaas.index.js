// ╔════════════════════════════════════════════════════════════════════╗
// ║ asaas.index.js — ponto de entrada da integração ASAAS              ║
// ║ Mantém a mesma API pública do antigo asaasApi.js                   ║
// ╚════════════════════════════════════════════════════════════════════╝

import { ensureAsaasCustomerForEcommerce, getCustomer } from './asaasCustomer.repository.js';
import { createCharge } from './asaasCharge.repository.js';
import { getPayment, updatePayment, cancelPayment } from './asaasPayments.repository.js';
import { getBoletoPdf, resolveLocalBoletoPath } from './asaasBoleto.repository.js';
import { listCharges, listPayments, listConfirmedPayments, getBalance } from './asaasQuery.repository.js';

export {
  ensureAsaasCustomerForEcommerce,
  createCharge,
  getPayment,
  getBoletoPdf,
  resolveLocalBoletoPath,
  listCharges,
  listPayments,
  listConfirmedPayments,
  getCustomer,
  getBalance,
  updatePayment,
  cancelPayment,
};

/* ---------------------------------------------------------------------- */
/* Export default — compatível com imports antigos                         */
/* ---------------------------------------------------------------------- */
const asaasApi = {
  createCharge,
  ensureAsaasCustomerForEcommerce,
  getPayment,

  // Atualização de boleto
  updatePayment,

  getBoletoPdf,
  resolveLocalBoletoPath,
  listCharges,
  listPayments,
  listConfirmedPayments,
  getCustomer,
  getBalance,
  cancelPayment,
};

export default asaasApi;
