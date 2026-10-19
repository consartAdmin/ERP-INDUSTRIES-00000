// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: productsFiscal.modal.js                                       ║
// ║ MODULE: Products Fiscal — Modals                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { showCenterModal } from '/public/includes/js/centerAlertModal.js';

export function notify({
  variant = 'info',
  title = 'Informação',
  message = '',
  timeoutMs = 15000,
} = {}) {
  showCenterModal({ variant, title, message, timeoutMs });
}
