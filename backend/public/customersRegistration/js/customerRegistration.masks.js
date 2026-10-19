// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: customerRegistration.masks.js                                 ║
// ║ MODULE: Customer Registration — Masks                               ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { $, onlyDigits } from './customerRegistration.utils.js';

export function bindMasks() {
  const tax = $('#tax_id');
  tax?.addEventListener('input', () => renderTaxMask());

  bindMask('#phone_number', formatPhone);
  bindMask('#mobile_number', formatMobile);
  bindMask('#financial_contact_phone', formatPhone);
  bindMask('#financial_contact_mobile', formatMobile);
  bindMask('#postal_code', formatPostalCode);

  const ibge = $('#ibge_city_code');
  ibge?.addEventListener('input', () => {
    ibge.value = onlyDigits(ibge.value).slice(0, 7);
  });
}

export function renderTaxMask() {
  const input = $('#tax_id');
  if (!input) return;

  const isPF = $('#person_type')?.value === 'F';
  input.value = isPF ? formatCpf(input.value) : formatCnpj(input.value);
}

function bindMask(selector, formatter) {
  const input = $(selector);
  input?.addEventListener('input', () => {
    input.value = formatter(input.value);
  });
}

function formatCpf(value) {
  return onlyDigits(value)
    .slice(0, 11)
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
}

function formatCnpj(value) {
  return onlyDigits(value)
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, '$1.$2.$3/$4-$5');
}

function formatPhone(value) {
  return onlyDigits(value)
    .slice(0, 10)
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

function formatMobile(value) {
  return onlyDigits(value)
    .slice(0, 11)
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}

function formatPostalCode(value) {
  return onlyDigits(value)
    .slice(0, 8)
    .replace(/(\d{5})(\d)/, '$1-$2');
}
