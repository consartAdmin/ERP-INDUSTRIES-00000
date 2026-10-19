// ╔════════════════════════════════════════════════════════════════════╗
// ║ asaasQuery.repository.js — Listagens e saldo (painel de gestão)    ║
// ║ listCharges / listPayments / listConfirmedPayments / getBalance    ║
// ╚════════════════════════════════════════════════════════════════════╝

import { asaasClient } from './asaasClient.repository.js';
import { logAsaasError } from './asaas.utils.js';

/* ---------------------------------------------------------------------- */
/* listCharges                                                             */
/* ---------------------------------------------------------------------- */
export async function listCharges({
  tipoData = 'dueDate',
  dataInicio,
  dataFim,
  status,        // ex: 'PENDING', 'RECEIVED', 'OVERDUE', etc
  billingType,   // ex: 'BOLETO', 'PIX'
  limit = 100,
  offset = 0,
  sort = 'dueDate', // orderBy
  order = 'asc',    // 'asc' | 'desc'
  externalReference,
  customer,
} = {}) {
  const params = new URLSearchParams();

  let dateField = 'dueDate';
  if (tipoData === 'paymentDate') dateField = 'paymentDate';
  if (tipoData === 'dateCreated') dateField = 'dateCreated';

  if (dataInicio) params.append(`${dateField}[ge]`, dataInicio);
  if (dataFim) params.append(`${dateField}[le]`, dataFim);

  if (status && status !== 'Todos' && status !== 'ALL') {
    params.append('status', status);
  }
  if (billingType) {
    params.append('billingType', billingType);
  }
  if (externalReference) {
    params.append('externalReference', String(externalReference));
  }
  if (customer) {
    params.append('customer', String(customer));
  }

  params.append('limit', String(limit));
  params.append('offset', String(offset));
  if (sort) params.append('orderBy', sort);
  if (order) params.append('sortDirection', String(order).toUpperCase());

  console.log('[AsaasAPI] 📃 Listando cobranças com filtros:', params.toString());

  try {
    const { data } = await asaasClient.get(`/payments?${params.toString()}`);
    return data;
  } catch (error) {
    logAsaasError('listCharges', error);
    throw error;
  }
}

/* ---------------------------------------------------------------------- */
/* listPayments (alias)                                                   */
/* ---------------------------------------------------------------------- */
export async function listPayments(options = {}) {
  return listCharges(options);
}

/* ---------------------------------------------------------------------- */
/* listConfirmedPayments                                                  */
/* ---------------------------------------------------------------------- */
export async function listConfirmedPayments({
  tipoData = 'paymentDate',
  dataInicio,
  dataFim,
  billingType,
  limit = 100,
  offset = 0,
  sort = 'paymentDate',
  order = 'asc',
} = {}) {
  const params = new URLSearchParams();

  let dateField = 'paymentDate';
  if (tipoData === 'dueDate') dateField = 'dueDate';
  if (tipoData === 'dateCreated') dateField = 'dateCreated';

  if (dataInicio) params.append(`${dateField}[ge]`, dataInicio);
  if (dataFim) params.append(`${dateField}[le]`, dataFim);

  params.append('status', 'RECEIVED');

  if (billingType) params.append('billingType', billingType);

  params.append('limit', String(limit));
  params.append('offset', String(offset));
  if (sort) params.append('orderBy', sort);
  if (order) params.append('sortDirection', String(order).toUpperCase());

  console.log('[AsaasAPI] 📃 Listando pagamentos confirmados com filtros:', params.toString());

  try {
    const { data } = await asaasClient.get(`/payments?${params.toString()}`);
    return data;
  } catch (error) {
    logAsaasError('listConfirmedPayments', error);
    throw error;
  }
}

/* ---------------------------------------------------------------------- */
/* getBalance                                                              */
/* ---------------------------------------------------------------------- */
export async function getBalance() {
  console.log('[AsaasAPI] 💰 Buscando saldo da conta Asaas...');
  try {
    const { data } = await asaasClient.get('/finance/balance');
    return data;
  } catch (error) {
    logAsaasError('getBalance', error);
    throw error;
  }
}
