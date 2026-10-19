// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeInutilizarEvents.init.js — Bootstrap único do módulo             ║
// ║ MODULE: NF-e Inutilização de Numeração                              ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import '/public/includes/js/core.js';

import { initModal } from './nfeInutilizarEvents.modal.js';
import { initNfeInutilizarEventsActions } from './nfeInutilizarEvents.actions.js';

async function initNfeInutilizarEvents() {
  try {
    initModal();
    await initNfeInutilizarEventsActions();
  } catch (error) {
    console.error('[nfeInutilizarEvents.init]', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNfeInutilizarEvents, { once: true });
} else {
  initNfeInutilizarEvents();
}
