// ╔════════════════════════════════════════════════════════════════════╗
// ║ transporters.sanitizers.js — Normalização e validação do payload   ║
// ╚════════════════════════════════════════════════════════════════════╝

import {
  normalizeNullable,
  normalizeDigits,
  normalizeUF,
  normalizeBoolean,
} from './transporters.utils.js';

export function sanitizePayload(data = {}, { keepDefaultIsActive = false } = {}) {
  return {
    trade_name: normalizeNullable(data.trade_name),
    legal_name: String(
      data.legal_name ??
      data.corporate_name ??
      ''
    ).trim(),

    tax_id: normalizeDigits(
      data.tax_id ??
      data.cnpj ??
      data.cnpj_cpf
    ),
    cpf: normalizeDigits(data.cpf),

    postal_code: normalizeDigits(data.postal_code ?? data.zip_code),
    street_type: normalizeNullable(data.street_type),
    street_name: normalizeNullable(data.street_name ?? data.address),
    street_number: normalizeNullable(data.street_number ?? data.address_number),
    address_complement: normalizeNullable(data.address_complement),
    neighborhood: normalizeNullable(data.neighborhood ?? data.district),
    city: normalizeNullable(data.city),
    state: normalizeUF(data.state ?? data.uf),
    ibge_location_id: normalizeNullable(
      data.ibge_location_id ??
      data.city_ibge_code
    ),

    contact_name: normalizeNullable(data.contact_name),
    phone_number: normalizeDigits(data.phone_number ?? data.phone),
    mobile_number: normalizeDigits(data.mobile_number ?? data.mobile),

    state_registration: normalizeNullable(data.state_registration),
    municipal_registration: normalizeNullable(data.municipal_registration),
    rntrc: normalizeNullable(data.rntrc ?? data.rntc),
    notes: normalizeNullable(data.notes),

    is_active:
      keepDefaultIsActive && typeof data.is_active === 'undefined'
        ? true
        : normalizeBoolean(data.is_active, true),
  };
}

export function validatePayload(payload) {
  if (!payload.legal_name) {
    throw new Error('Legal name is required.');
  }

  if (payload.tax_id && payload.tax_id.length !== 14) {
    throw new Error('Invalid CNPJ/tax ID. It must contain 14 digits.');
  }

  if (payload.cpf && payload.cpf.length !== 11) {
    throw new Error('Invalid CPF. It must contain 11 digits.');
  }

  if (payload.tax_id && payload.cpf) {
    throw new Error('Provide either CNPJ/tax ID or CPF, not both.');
  }

  if (payload.state && payload.state.length !== 2) {
    throw new Error('State must contain 2 characters.');
  }
}
