// ╔══════════════════════════════════════════════════════════════════════╗
// ║ cancelarNfe.init.js — Bootstrap único do módulo                    ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import '/public/includes/js/core.js';

import {
  initCancelNfeActions,
} from './cancelarNfe.actions.js';

async function initCancelarNfe() {
  try {
    await initCancelNfeActions();
  } catch (error) {
    console.error(
      '[cancelarNfe.init]',
      error
    );
  }
}

if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    () => {
      initCancelarNfe();
    },
    { once: true }
  );
} else {
  initCancelarNfe();
}
