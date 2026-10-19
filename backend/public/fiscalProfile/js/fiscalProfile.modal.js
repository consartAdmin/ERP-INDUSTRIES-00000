// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: fiscalProfile.modal.js                                        ║
// ║ MODULE: Fiscal Profile — Alerts and Confirmation                    ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { showCenterModal } from '/public/includes/js/centerAlertModal.js';

export const toast = {
  info(title, message, timeoutMs = 3800) {
    return showCenterModal({ variant: 'info', title, message, timeoutMs });
  },

  success(title, message, timeoutMs = 4200) {
    return showCenterModal({ variant: 'success', title, message, timeoutMs });
  },

  warn(title, message) {
    return showCenterModal({ variant: 'warning', title, message });
  },

  error(title, message) {
    return showCenterModal({ variant: 'error', title, message });
  },
};

export function confirmDeleteProfile(profile) {
  return window.confirm(
    `Deseja realmente desativar o perfil fiscal "${profile.profile_name}" ` +
    `(ID ${profile.fiscal_profile_id})?`,
  );
}
