// ╔══════════════════════════════════════════════════════════════════════╗
// ║ enterprise.init.js                                                  ║
// ║ Inicialização do módulo Empresas                                    ║
// ║ ÚNICO arquivo JS importado diretamente pelo enterprise.html         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  editEnterpriseById,
  loadEnterprises,
  removeCurrentEnterpriseLogo,
  saveEnterpriseEdition,
  uploadSelectedEnterpriseLogo,
} from './enterprise.actions.js';
import { SELECTORS } from './enterprise.config.js';
import { bindEnterpriseFormMasks, getEnterpriseFormElement } from './enterprise.form.js';
import { setupEnterpriseModal } from './enterprise.modal.js';
import { $ } from './enterprise.utils.js';

function bindListEvents() {
  $(SELECTORS.btnSearch)?.addEventListener('click', loadEnterprises);

  $(SELECTORS.searchInput)?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    loadEnterprises();
  });

  $(SELECTORS.filterActive)?.addEventListener('change', loadEnterprises);

  $(SELECTORS.tableBody)?.addEventListener('click', (event) => {
    const editButton = event.target.closest('[data-enterprise-action="edit"]');
    if (!editButton) return;

    editEnterpriseById(editButton.dataset.enterpriseId);
  });
}

function bindFormEvents() {
  $(SELECTORS.btnSelectEnterpriseLogo)?.addEventListener('click', () => {
    $(SELECTORS.enterpriseLogoFile)?.click();
  });

  $(SELECTORS.enterpriseLogoFile)?.addEventListener('change', async (event) => {
    const file = event.currentTarget?.files?.[0];
    if (!file) return;

    try {
      await uploadSelectedEnterpriseLogo(file);
    } catch {
      // A ação já apresenta a mensagem adequada ao usuário.
    }
  });

  $(SELECTORS.btnRemoveEnterpriseLogo)?.addEventListener('click', async () => {
    if (!window.confirm('Deseja remover a logo atual desta empresa?')) return;

    try {
      await removeCurrentEnterpriseLogo();
    } catch {
      // A ação já apresenta a mensagem adequada ao usuário.
    }
  });

  getEnterpriseFormElement()?.addEventListener('submit', async (event) => {
    event.preventDefault();

    try {
      await saveEnterpriseEdition();
    } catch {
      // A ação já apresenta a mensagem adequada ao usuário.
    }
  });

  bindEnterpriseFormMasks();
}

async function bootstrapEnterpriseModule() {
  setupEnterpriseModal();
  bindListEvents();
  bindFormEvents();
  await loadEnterprises();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapEnterpriseModule, { once: true });
} else {
  bootstrapEnterpriseModule();
}
