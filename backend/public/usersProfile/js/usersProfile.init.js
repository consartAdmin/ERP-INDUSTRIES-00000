// ╔══════════════════════════════════════════════════════════════════════╗
// ║ usersProfile.init.js                                                ║
// ║ Inicialização do módulo Perfis de Usuários                          ║
// ║ ÚNICO arquivo JS importado diretamente pelo usersProfile.html       ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  applyBulkProfile,
  changeModuleFlag,
  changeModuleProfile,
  loadProfilesCatalog,
  loadUsers,
  openProfilesForUser,
  saveProfiles,
} from './usersProfile.actions.js';
import { SELECTORS } from './usersProfile.config.js';
import { setupUsersProfileModal } from './usersProfile.modal.js';
import { applyModuleFilter } from './usersProfile.render.js';
import { $, showMessage } from './usersProfile.utils.js';

console.log('VERSAO_USERSPROFILE 1.0');

function bindListEvents() {
  $(SELECTORS.btnSearch)?.addEventListener('click', loadUsers);
  $(SELECTORS.filterActive)?.addEventListener('change', loadUsers);

  $(SELECTORS.searchInput)?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    loadUsers();
  });

  $(SELECTORS.usersTableBody)?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-up-action="profiles"]');
    if (!button) return;

    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Abrindo...';

    try {
      await openProfilesForUser(button.dataset.userId);
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  });
}

function bindModalEvents() {
  const tbody = $(SELECTORS.modulesTableBody);

  tbody?.addEventListener('change', (event) => {
    const target = event.target;
    const moduloId = target?.dataset?.moduloRow;
    if (!moduloId) return;

    if (target.matches('[data-up-profile]')) {
      changeModuleProfile(moduloId, target.value);
      return;
    }

    if (target.matches('[data-up-flag]')) {
      changeModuleFlag(moduloId, target.dataset.upFlag, target.checked);
    }
  });

  $(SELECTORS.moduleSearch)?.addEventListener('input', applyModuleFilter);
  $(SELECTORS.btnApplyBulk)?.addEventListener('click', applyBulkProfile);

  $(SELECTORS.form)?.addEventListener('submit', (event) => {
    event.preventDefault();
    saveProfiles();
  });
}

async function bootstrapUsersProfileModule() {
  setupUsersProfileModal();
  bindListEvents();
  bindModalEvents();

  try {
    await loadProfilesCatalog();
  } catch (error) {
    console.error('[usersProfile] Erro ao carregar catálogo de perfis:', error);
    showMessage(error.message || 'Erro ao carregar catálogo de perfis.', 'error');
  }

  await loadUsers();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapUsersProfileModule, { once: true });
} else {
  bootstrapUsersProfileModule();
}
