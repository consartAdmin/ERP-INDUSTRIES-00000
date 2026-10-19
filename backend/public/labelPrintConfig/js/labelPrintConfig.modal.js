// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: labelPrintConfig.modal.js                                     ║
// ║ MODULE: Label Print Config — Messages and Confirmation              ║
// ║ PRODNEX ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { showCenterModal } from '/public/includes/js/centerAlertModal.js';

export const toast = {
  success: (title, message) =>
    showCenterModal({ variant: 'success', title, message, timeoutMs: 3500 }),
  error: (title, message) =>
    showCenterModal({ variant: 'error', title, message }),
  warn: (title, message) =>
    showCenterModal({ variant: 'warning', title, message }),
  info: (title, message) =>
    showCenterModal({ variant: 'info', title, message, timeoutMs: 3200 }),
};

export function confirmRestoreConfig() {
  return window.confirm(
    'Deseja restaurar a configuração padrão da etiqueta?'
  );
}
