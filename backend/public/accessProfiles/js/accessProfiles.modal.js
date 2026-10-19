// ╔══════════════════════════════════════════════════════════════════════╗
// ║ accessProfiles.modal.js                                             ║
// ║ Integração do modal de perfil com o controller global               ║
// ║ Global: /public/includes/js/modal.js                                ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Modal } from '/public/includes/js/modal.js';
import { SELECTORS } from './accessProfiles.config.js';
import { $, escapeHtml } from './accessProfiles.utils.js';

export function setupAccessProfileModal() {
  Modal.setup();
}

export function openAccessProfileModal(profile = null) {
  const title = $(SELECTORS.modalTitle);
  const subtitle = $(SELECTORS.modalSubtitle);

  if (title) title.textContent = profile ? 'Editar perfil' : 'Novo perfil';
  if (subtitle) {
    subtitle.innerHTML = profile
      ? `Editando <strong>${escapeHtml(profile.name)}</strong>.`
      : 'Informe o nome e marque o que o perfil pode fazer.';
  }

  return Modal.open(SELECTORS.modal, { focusSelector: SELECTORS.name });
}

export function closeAccessProfileModal() {
  return Modal.close(SELECTORS.modal);
}
