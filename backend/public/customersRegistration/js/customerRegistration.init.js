// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: customerRegistration.init.js                                  ║
// ║ MODULE: Customer Registration — Initialization                      ║
// ║ PRODNEX ERP                                                         ║
// ║ Registration page bootstrap and module orchestration                ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { bindActions } from './customerRegistration.actions.js';
import { bindMasks } from './customerRegistration.masks.js';
import { showError } from './customerRegistration.modal.js';
import { loadSelects } from './customerRegistration.selects.js';
import { initializeIbgeLocations } from './customerRegistration.ibge.js';
import { initFinancialDefaults } from '/public/includes/js/customerFinancialDefaults.js';

document.addEventListener('DOMContentLoaded', () => {
  void boot();
});

async function boot() {
  try {
    bindActions();
    bindMasks();
    await Promise.all([
      loadSelects(),
      initializeIbgeLocations(),
      initFinancialDefaults(), // plano de contas / categoria / subcategoria
    ]);
  } catch (error) {
    console.error('[customerRegistration.boot]', error);
    showError(
      'Cadastro de clientes',
      'Não foi possível iniciar o cadastro de clientes.'
    );
  }
}
