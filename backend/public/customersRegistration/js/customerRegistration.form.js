// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: customerRegistration.form.js                                  ║
// ║ MODULE: Customer Registration — Form                                ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { getValue, onlyDigits, trimOrNull } from './customerRegistration.utils.js';
import { readFinancialDefaults } from '/public/includes/js/customerFinancialDefaults.js';

export function buildCustomerPayload() {
  const personType = getValue('person_type') || 'J';
  let tradeName = trimOrNull(getValue('trade_name'));
  let legalName = trimOrNull(getValue('legal_name'));

  // Pessoa Física usa Nome Completo no campo principal e mantém
  // compatibilidade com backends que esperam trade_name + legal_name.
  if (personType === 'F') {
    legalName = legalName || tradeName;
    tradeName = tradeName || legalName;
  }

  return {
    name: tradeName || legalName,
    customer_type: personType,
    person_type: personType,
    trade_name: tradeName,
    legal_name: legalName,
    tax_id: onlyDigits(getValue('tax_id')),

    business_segment: trimOrNull(getValue('business_segment')),
    classification: trimOrNull(getValue('classification')),
    salesperson: trimOrNull(getValue('customer-seller-select')),
    is_active: String(getValue('is_active')).toLowerCase() === 'true',

    email: trimOrNull(getValue('email')),
    postal_code: trimOrNull(onlyDigits(getValue('postal_code'))),
    street_type: trimOrNull(getValue('street_type')),
    street_name: trimOrNull(getValue('street_name')),
    street_number: trimOrNull(getValue('street_number')),
    address_complement: trimOrNull(getValue('address_complement')),
    neighborhood: trimOrNull(getValue('neighborhood')),
    city: trimOrNull(getValue('city')),
    state: trimOrNull(getValue('state')),
    ibge_city_code: trimOrNull(onlyDigits(getValue('ibge_city_code'))),

    contact_name: trimOrNull(getValue('contact_name')),
    phone_number: trimOrNull(getValue('phone_number')),
    mobile_number: trimOrNull(getValue('mobile_number')),

    financial_contact_name: trimOrNull(getValue('financial_contact_name')),
    financial_contact_email: trimOrNull(getValue('financial_contact_email')),
    financial_contact_phone: trimOrNull(getValue('financial_contact_phone')),
    financial_contact_mobile: trimOrNull(getValue('financial_contact_mobile')),
    billing_email: trimOrNull(getValue('billing_email')),
    invoice_email: trimOrNull(getValue('invoice_email')),
    financial_contact_notes: trimOrNull(getValue('financial_contact_notes')),

    // Classificação padrão (Movimentação de Caixa)
    ...readFinancialDefaults(),

    customer_ad_street_type: trimOrNull(getValue('customer_ad_street_type')),
    customer_ad_street_name: trimOrNull(getValue('customer_ad_street_name')),
    customer_ad_street_number: trimOrNull(getValue('customer_ad_street_number')),
    customer_ad_address_complement: trimOrNull(getValue('customer_ad_address_complement')),
    customer_ad_neighborhood: trimOrNull(getValue('customer_ad_neighborhood')),
    customer_ad_city: trimOrNull(getValue('customer_ad_city')),
    customer_ad_state: trimOrNull(getValue('customer_ad_state'))?.toUpperCase() || null,
    customer_ad_active: String(getValue('customer_ad_active')).toLowerCase() === 'true',

    asaas_id: trimOrNull(getValue('asaas_id')),
    state_registration: personType === 'F' ? null : trimOrNull(getValue('state_registration')),
    municipal_registration: personType === 'F' ? null : trimOrNull(getValue('municipal_registration')),
  };
}

export function buildLegacyPayload(payload) {
  return {
    ...payload,
    name: payload.name || payload.trade_name || payload.legal_name,
    trade_name: payload.trade_name || payload.name,
    legal_name: payload.legal_name || payload.name,
  };
}
