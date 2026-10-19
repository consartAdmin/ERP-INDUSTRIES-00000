// Payment Methods — shared Modal integration

'use strict';

import { Modal } from '/public/includes/js/modal.js';
import { MODAL_FOCUS_SELECTOR, MODAL_ID } from './paymentMethods.config.js';
import {
  clearPaymentMethodsForm,
  fillPaymentMethodsForm,
  getPaymentMethodsForm,
  setPaymentMethodsFormMode,
} from './paymentMethods.form.js';

let initialized = false;

export function setupPaymentMethodsModal() {
  if (initialized) return true;

  const modal = document.getElementById(MODAL_ID);
  if (!modal || !getPaymentMethodsForm()) return false;

  initialized = true;
  Modal.setup();

  if (modal.getAttribute('aria-hidden') !== 'false') {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  }

  return true;
}

export function openPaymentMethodsModal(data = null) {
  if (!setupPaymentMethodsModal()) return false;

  clearPaymentMethodsForm();
  setPaymentMethodsFormMode(data ? 'edit' : 'create');
  if (data) fillPaymentMethodsForm(data);

  return Modal.open(MODAL_ID, {
    focusSelector: MODAL_FOCUS_SELECTOR,
  });
}

export function closePaymentMethodsModal() {
  return Modal.close(MODAL_ID);
}

export function isPaymentMethodsModalOpen() {
  return Modal.isOpen(MODAL_ID);
}
