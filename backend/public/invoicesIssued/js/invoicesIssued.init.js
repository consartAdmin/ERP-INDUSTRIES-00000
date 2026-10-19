// ╔══════════════════════════════════════════════════════════════════════╗
// ║ invoicesIssued.init.js — Bootstrap único do módulo                 ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import '/public/includes/js/core.js';

import './invoicesIssued.form.js';

import { loadNfeStatusOptions } from './invoicesIssued.form.js';
import { initInvoicesIssuedActions } from './invoicesIssued.actions.js';

async function initInvoicesIssued() {
  try {
    await loadNfeStatusOptions();
  } catch (error) {
    console.error('[invoicesIssued.statusMap]', error);
  }

  await initInvoicesIssuedActions();
}

if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    () => {
      initInvoicesIssued().catch((error) => {
        console.error('[invoicesIssued.init]', error);
      });
    },
    { once: true },
  );
} else {
  initInvoicesIssued().catch((error) => {
    console.error('[invoicesIssued.init]', error);
  });
}
