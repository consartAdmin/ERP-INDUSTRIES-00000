// ╔══════════════════════════════════════════════════════════════════════╗
// ║ usersProfile.modal.js                                               ║
// ║ Integração do modal de perfis com o controller global               ║
// ║ Global: /public/includes/js/modal.js                                ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Modal } from '/public/includes/js/modal.js';
import { SELECTORS } from './usersProfile.config.js';
import { $, escapeHtml } from './usersProfile.utils.js';

export function setupUsersProfileModal() {
  Modal.setup();
}

export function openUsersProfileModal(user = {}) {
  const title = $(SELECTORS.modalTitle);
  const subtitle = $(SELECTORS.modalSubtitle);
  const name = user.name || 'usuário';

  if (title) title.textContent = `Perfis de ${name}`;
  if (subtitle) {
    subtitle.innerHTML =
      `Usuário <strong>#${escapeHtml(user.user_id)}</strong> · ${escapeHtml(user.email || 'sem e-mail')}. ` +
      'Escolha o perfil de acesso em cada módulo.';
  }

  return Modal.open(SELECTORS.modal, { focusSelector: SELECTORS.moduleSearch });
}

export function closeUsersProfileModal() {
  return Modal.close(SELECTORS.modal);
}
