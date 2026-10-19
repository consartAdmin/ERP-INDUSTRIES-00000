// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: customerRegistration.modal.js                                 ║
// ║ MODULE: Customer Registration — Modals                              ║
// ║ PRODNEX ERP                                                         ║
// ║ Centralized validation, success, warning and error messages         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { showCenterModal } from '/public/includes/js/centerAlertModal.js';

export function showValidation(message) {
  showCenterModal({
    variant: 'warning',
    title: 'Validação',
    message,
  });
}

export function showWarning(title, message) {
  showCenterModal({ variant: 'warning', title, message });
}

export function showError(title, message) {
  showCenterModal({ variant: 'error', title, message });
}

export function showSuccess(title, message, timeoutMs = 2000) {
  showCenterModal({
    variant: 'success',
    title,
    message,
    timeoutMs,
  });
}
