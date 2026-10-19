// Payment Methods — modal form data

'use strict';

import { GAP_FIELDS, MODAL_ID, SELECTORS } from './paymentMethods.config.js';
import { $, prettyDate, toInt } from './paymentMethods.utils.js';

function getModal() {
  return document.getElementById(MODAL_ID);
}

export function getPaymentMethodsForm() {
  const modal = getModal();
  return modal ? $(SELECTORS.form, modal) : null;
}

export function clearPaymentMethodsForm() {
  const modal = getModal();
  const form = getPaymentMethodsForm();
  if (!modal || !form) return false;

  form.reset();
  $('#cpm_id', modal).value = '';
  $('#cpm_installments', modal).value = 1;
  for (const field of GAP_FIELDS) $(`#cpm_${field}`, modal).value = 0;
  $('#cpm_active', modal).checked = true;
  $('#cpm_created_at', modal).textContent = '—';
  $('#cpm_updated_at', modal).textContent = '—';
  return true;
}

export function fillPaymentMethodsForm(paymentMethod = {}) {
  const modal = getModal();
  if (!modal) return false;

  $('#cpm_id', modal).value = paymentMethod.id ?? paymentMethod.paymentMethods_id ?? '';
  $('#cpm_name', modal).value = paymentMethod.name ?? '';
  $('#cpm_type', modal).value = paymentMethod.type ?? '';
  $('#cpm_installments', modal).value = paymentMethod.installments ?? 1;
  $('#cpm_nfe_tpag', modal).value = paymentMethod.nfe_tpag ?? '';
  for (const field of GAP_FIELDS) {
    $(`#cpm_${field}`, modal).value = paymentMethod[field] ?? 0;
  }
  $('#cpm_active', modal).checked = paymentMethod.active !== false;
  $('#cpm_created_at', modal).textContent = paymentMethod.created_at
    ? prettyDate(paymentMethod.created_at)
    : '—';
  $('#cpm_updated_at', modal).textContent = paymentMethod.updated_at
    ? prettyDate(paymentMethod.updated_at)
    : '—';
  return true;
}

export function setPaymentMethodsFormMode(mode) {
  const modal = getModal();
  if (!modal) return false;

  const editing = mode === 'edit';
  $('#cpmTitle', modal).textContent = editing
    ? 'Editar Forma de Pagamento'
    : 'Nova Forma de Pagamento';
  return true;
}

export function readPaymentMethodsForm() {
  const modal = getModal();
  if (!modal) return null;

  const payload = {
    name: $('#cpm_name', modal).value.trim(),
    type: $('#cpm_type', modal).value,
    installments: toInt($('#cpm_installments', modal).value, 1),
    nfe_tpag: $('#cpm_nfe_tpag', modal).value.trim() || null,
    active: $('#cpm_active', modal).checked,
  };

  for (const field of GAP_FIELDS) {
    payload[field] = toInt($(`#cpm_${field}`, modal).value);
  }

  return {
    id: $('#cpm_id', modal).value,
    payload,
  };
}
