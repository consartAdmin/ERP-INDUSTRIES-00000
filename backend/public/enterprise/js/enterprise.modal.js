// ╔══════════════════════════════════════════════════════════════════════╗
// ║ enterprise.modal.js                                                 ║
// ║ Integração do modal de edição de Empresas com o controller global   ║
// ║ Global: /public/includes/js/modal.js                                ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Modal } from '/public/includes/js/modal.js';
import { SELECTORS } from './enterprise.config.js';
import { $, escapeHtml } from './enterprise.utils.js';

export function setupEnterpriseModal() {
  Modal.setup();
}

export function isEnterpriseModalOpen() {
  return Modal.isOpen(SELECTORS.modal);
}

export function openEnterpriseModal(enterprise = {}) {
  const modal = $(SELECTORS.modal);
  if (!modal) return false;

  const title = $(SELECTORS.modalTitle);
  const subtitle = $(SELECTORS.modalSubtitle);
  const displayName = enterprise.trade_name || enterprise.corporate_name || 'empresa';

  if (title) {
    title.textContent = 'Editar empresa';
  }

  if (subtitle) {
    subtitle.innerHTML = `Editando <strong>${escapeHtml(displayName)}</strong>.`;
  }

  return Modal.open(SELECTORS.modal, {
    focusSelector: SELECTORS.corporate_name,
  });
}

export function closeEnterpriseModal() {
  return Modal.close(SELECTORS.modal);
}
