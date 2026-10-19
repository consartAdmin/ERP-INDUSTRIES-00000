// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: customersList.modal.js                                        ║
// ║ MODULE: Customers List — Modals                                     ║
// ║ PRODNEX ERP                                                         ║
// ║ Centralized error, warning and export feedback modals               ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { showCenterModal } from '/public/includes/js/centerAlertModal.js';

export function showError(title, message) {
  showCenterModal({ variant: 'error', title, message });
}

export function showExportCancelled(typeLabel) {
  showCenterModal({
    variant: 'warning',
    title: `Exportação ${typeLabel}`,
    message: `A exportação ${typeLabel} foi cancelada.`,
  });
}

export function showMissingKey(typeLabel) {
  showCenterModal({
    variant: 'warning',
    title: `Exportação ${typeLabel}`,
    message: `Informe a chave para liberar a exportação ${typeLabel}.`,
  });
}
