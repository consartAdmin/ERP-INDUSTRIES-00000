// ╔══════════════════════════════════════════════════════════════════════╗
// ║ accessProfiles.init.js                                              ║
// ║ Inicialização do Cadastro de Perfis                                 ║
// ║ ÚNICO arquivo JS importado diretamente pelo accessProfiles.html     ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  loadProfiles,
  openEditProfile,
  openNewProfile,
  removeProfile,
  saveProfile,
} from './accessProfiles.actions.js';
import { SELECTORS } from './accessProfiles.config.js';
import { handleFlagChange, syncCodeFromName } from './accessProfiles.form.js';
import { setupAccessProfileModal } from './accessProfiles.modal.js';
import { $ } from './accessProfiles.utils.js';

console.log('VERSAO_ACCESSPROFILES 1.0');

function bindListEvents() {
  $(SELECTORS.btnSearch)?.addEventListener('click', loadProfiles);
  $(SELECTORS.filterActive)?.addEventListener('change', loadProfiles);
  $(SELECTORS.btnNew)?.addEventListener('click', openNewProfile);

  $(SELECTORS.searchInput)?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    loadProfiles();
  });

  $(SELECTORS.tableBody)?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-apf-action]');
    if (!button) return;

    if (button.dataset.apfAction === 'edit') openEditProfile(button.dataset.id);
    if (button.dataset.apfAction === 'delete') removeProfile(button.dataset.id);
  });
}

function bindFormEvents() {
  $(SELECTORS.name)?.addEventListener('input', syncCodeFromName);

  $(SELECTORS.form)?.addEventListener('change', (event) => {
    if (event.target.matches('[data-apf-flag]')) handleFlagChange(event.target);
  });

  $(SELECTORS.form)?.addEventListener('submit', (event) => {
    event.preventDefault();
    saveProfile();
  });
}

async function bootstrapAccessProfilesModule() {
  setupAccessProfileModal();
  bindListEvents();
  bindFormEvents();
  await loadProfiles();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapAccessProfilesModule, { once: true });
} else {
  bootstrapAccessProfilesModule();
}
