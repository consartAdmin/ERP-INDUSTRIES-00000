// ╔══════════════════════════════════════════════════════════════════════╗
// ║ customersEdit.form.js — Leitura e preenchimento do formulário       ║
// ╚══════════════════════════════════════════════════════════════════════╝
'use strict';

import { DELIVERY_ADDRESS_FIELDS, FINANCIAL_CONTACT_FIELDS } from './customersEdit.config.js';
import { getValue, setValue, trimOrNull } from './customersEdit.utils.js';

export function fillFinancialContact(customer = {}) {
  for (const field of FINANCIAL_CONTACT_FIELDS) setValue(field, customer[field]);
}

export function readFinancialContact() {
  return Object.fromEntries(
    FINANCIAL_CONTACT_FIELDS.map((field) => [field, trimOrNull(getValue(field))])
  );
}

export function clearFinancialContact() {
  for (const field of FINANCIAL_CONTACT_FIELDS) setValue(field, '');
}

export function fillDeliveryAddress(customer = {}) {
  const address =
    customer.delivery_address ||
    customer.deliveryAddress ||
    customer.customer_address_delivery ||
    customer.customerAddressDelivery ||
    customer;

  for (const field of DELIVERY_ADDRESS_FIELDS) {
    const fallback = field === 'customer_ad_active' ? true : '';
    setValue(field, address[field] ?? fallback);
  }
}

export function readDeliveryAddress() {
  return Object.fromEntries(
    DELIVERY_ADDRESS_FIELDS.map((field) => {
      if (field === 'customer_ad_active') {
        return [field, String(getValue(field)).toLowerCase() === 'true'];
      }
      return [field, trimOrNull(getValue(field))];
    })
  );
}

export function clearDeliveryAddress() {
  for (const field of DELIVERY_ADDRESS_FIELDS) {
    setValue(field, field === 'customer_ad_active' ? 'true' : '');
  }
}
