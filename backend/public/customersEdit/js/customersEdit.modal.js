// ╔══════════════════════════════════════════════════════════════════════╗
// ║ customersEdit.modal.js — Mensagens centralizadas | PRODNEX ERP      ║
// ╚══════════════════════════════════════════════════════════════════════╝
'use strict';

import { showCenterModal } from '/public/includes/js/centerAlertModal.js';

export const showSuccess = (message, title = 'Salvo') =>
  showCenterModal({ variant: 'success', title, message, timeoutMs: 2000 });

export const showError = (message, title = 'Falha') =>
  showCenterModal({ variant: 'error', title, message });

export const showWarning = (message, title = 'Validação') =>
  showCenterModal({ variant: 'warning', title, message });
