// ╔════════════════════════════════════════════════════════════════════╗
// ║ asaasCustomer.repository.js — Clientes Asaas                       ║
// ║ ensureAsaasCustomerForEcommerce / getCustomer                      ║
// ╚════════════════════════════════════════════════════════════════════╝

import { asaasClient } from './asaasClient.repository.js';
import { sanitizeString, logAsaasError } from './asaas.utils.js';

/* ---------------------------------------------------------------------- */
/* ensureAsaasCustomerForEcommerce                                        */
/* ---------------------------------------------------------------------- */
export async function ensureAsaasCustomerForEcommerce({
  name,
  email,
  cpfCnpj,
  phone,
  mobilePhone,
}) {
  const payload = {
    name: sanitizeString(name),
    email: sanitizeString(email),
    cpfCnpj: sanitizeString(cpfCnpj),
    phone: sanitizeString(phone),
    mobilePhone: sanitizeString(mobilePhone),
  };

  if (!payload.cpfCnpj && !payload.email) {
    throw new Error('[AsaasAPI] É necessário informar ao menos cpfCnpj ou email para criar/ localizar cliente.');
  }

  try {
    // 1) Tenta localizar cliente existente por cpfCnpj ou email
    const searchParams = new URLSearchParams();
    if (payload.cpfCnpj) searchParams.append('cpfCnpj', payload.cpfCnpj);
    if (payload.email) searchParams.append('email', payload.email);

    console.log('[AsaasAPI] 🔍 Buscando cliente no Asaas com:', searchParams.toString());

    const { data: searchData } = await asaasClient.get(`/customers?${searchParams.toString()}`);

    const found = Array.isArray(searchData?.data) ? searchData.data[0] : undefined;

    if (found?.id) {
      console.log('[AsaasAPI] ✅ Cliente encontrado no Asaas:', found.id);
      return found.id;
    }

    // 2) Não encontrou → cria novo cliente
    const createPayload = {
      name: payload.name || 'Cliente Loja Online',
      email: payload.email,
      cpfCnpj: payload.cpfCnpj,
      phone: payload.phone,
      mobilePhone: payload.mobilePhone,
    };

    console.log('[AsaasAPI] ➕ Criando cliente no Asaas...', createPayload);

    const { data: created } = await asaasClient.post('/customers', createPayload);

    if (!created?.id) {
      throw new Error('[AsaasAPI] Falha ao criar cliente no Asaas (sem ID retornado).');
    }

    console.log('[AsaasAPI] ✅ Cliente criado no Asaas:', created.id);
    return created.id;
  } catch (error) {
    logAsaasError('ensureCustomer', error);
    throw error;
  }
}

/* ---------------------------------------------------------------------- */
/* getCustomer                                                             */
/* ---------------------------------------------------------------------- */
export async function getCustomer(customerId) {
  if (!customerId) throw new Error('[AsaasAPI] getCustomer: customerId não informado.');

  console.log('[AsaasAPI] 👤 Buscando cliente Asaas:', customerId);

  try {
    const { data } = await asaasClient.get(`/customers/${customerId}`);
    return data;
  } catch (error) {
    logAsaasError('getCustomer', error);
    throw error;
  }
}
