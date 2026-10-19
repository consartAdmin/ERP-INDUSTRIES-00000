// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgets.js — BOOT (PRODNEX ERP | ESM)                              ║
// ║ Orquestra os módulos separados                                     ║
// ║ ✅ Tabs                                                            ║
// ║ ✅ Lista                                                           ║
// ║ ✅ Editor                                                          ║
// ║ ✅ Catálogos                                                       ║
// ║ ✅ Modal de observação                                             ║
// ║ ✅ Pré-visualização DANFE em PDF                                   ║
// ║ ✅ Modal de pagamentos                                             ║
// ║ ✅ Modal de desconto geral                                         ║
// ║ ✅ Parâmetros globais                                              ║
// ║ ✅ Helpers globais úteis                                           ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  installGlobalCrashHandlers,
} from './js/budgets.infra.js';

import {
  bindTabs,
  activateTab,
  bindEditorUI,
} from './js/budgets.editor.js';

import {
  bindListUI,
  fetchBudgets,
} from './js/budgets.list.js';

import {
  loadPriceTablesCatalog,
  loadPaymentMethods,
} from './js/budgets.catalogs.js';

import {
  setPrintEnabled,
  bindGlobalDiscountActions,
} from './js/budgets.actions.js';

import {
  recalcTotals,
} from './js/budgets.items.js';

import {
  setupObsModal,
} from './js/budgets.modals.js';

import {
  initBudgetPaymentsModal,
} from './js/budgetsPaymentsModal.js';

import {
  initBudgetSettings,
} from './js/budgets.settings.js';

import {
  initBudgetNfePreview,
} from './js/budgets.nfePreview.js';

import {
  initBudgetPriceMode,
} from './js/budgets.priceMode.js';

import {
  initBudgetStockMode,
} from './js/budgets.stockMode.js';

import {
  initBudgetNfeIssuanceMode,
} from './js/budgets.nfeIssuanceMode.js';

/**
 * Inicializa o módulo de orçamentos.
 */
async function bootstrapBudgets() {
  console.log(
    '[budgets] DOMContentLoaded'
  );

  installGlobalCrashHandlers();

  await initBudgetPriceMode();

  await initBudgetStockMode();

  await initBudgetNfeIssuanceMode();
  /* =======================================================
     Base UI
  ======================================================= */

  bindTabs();
  bindListUI();
  bindEditorUI();

  /* =======================================================
     Observation modal
  ======================================================= */

  try {
    setupObsModal();
  } catch (error) {
    console.warn(
      '[budgets] setupObsModal error:',
      error?.message || error
    );
  }

  /* =======================================================
     DANFE PDF preview modal
  ======================================================= */

  try {
    initBudgetNfePreview();
  } catch (error) {
    console.warn(
      '[budgets] initBudgetNfePreview error:',
      error?.message || error
    );
  }

  /* =======================================================
     Payments modal
  ======================================================= */

  try {
    initBudgetPaymentsModal();
  } catch (error) {
    console.warn(
      '[budgets] initBudgetPaymentsModal error:',
      error?.message || error
    );
  }

  /* =======================================================
     Global discount modal
  ======================================================= */

  try {
    bindGlobalDiscountActions();
  } catch (error) {
    console.warn(
      '[budgets] bindGlobalDiscountActions error:',
      error?.message || error
    );
  }

  /* =======================================================
     Global budget settings
  ======================================================= */

  try {
    await initBudgetSettings();
  } catch (error) {
    console.warn(
      '[budgets] initBudgetSettings error:',
      error?.message || error
    );
  }

  /* =======================================================
     Catalogs
  ======================================================= */

  try {
    await Promise.all([
      Promise.resolve(
        loadPriceTablesCatalog()
      ),

      Promise.resolve(
        loadPaymentMethods()
      ),
    ]);
  } catch (error) {
    console.warn(
      '[budgets] catalogs load error:',
      error?.message || error
    );
  }

  /* =======================================================
     Initial budget list
  ======================================================= */

  try {
    await fetchBudgets();
  } catch (error) {
    console.warn(
      '[budgets] fetchBudgets error:',
      error?.message || error
    );
  }

  /* =======================================================
     Global helpers
  ======================================================= */

  window.recalcBudgetTotals =
    recalcTotals;

  /* =======================================================
     Initial screen
  ======================================================= */

  activateTab('list');
  setPrintEnabled(false);

  console.log(
    '[budgets] bootstrap done'
  );
}

/* =========================================================
   Application boot
========================================================= */

document.addEventListener(
  'DOMContentLoaded',
  () => {
    bootstrapBudgets()
      .catch((error) => {
        console.error(
          '[budgets] bootstrap fatal error:',
          error
        );
      });
  }
);
