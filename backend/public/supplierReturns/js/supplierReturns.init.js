// ╔══════════════════════════════════════════════════════════════════════╗
// ║ supplierReturns.init.js — Ponto de entrada do módulo                 ║
// ║ PRODNEX ERP | Devolução ao Fornecedor                                ║
// ║ Único script carregado pelo supplierReturns.html                     ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { bindImportedItemsForm } from './supplierReturns.form.js';
import { bindSupplierReturnActions, loadReturns } from './supplierReturns.actions.js';

async function init() {
  bindImportedItemsForm();
  bindSupplierReturnActions();
  await loadReturns();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
