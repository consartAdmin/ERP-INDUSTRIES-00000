// ╔══════════════════════════════════════════════════════════════════════╗
// ║ salesReport.init.js — Inicialização | PRODNEX ERP                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  bindActions,
  loadAndRenderSalesReport,
  setupTabs,
} from './salesReport.actions.js';
import { YEAR_SELECT_OPTIONS } from './salesReport.config.js';
import {
  setupDateRangeFilter,
  setupYearSelect,
} from './salesReport.filters.js';
import {
  setupAlertModal,
  setupSearchModals,
} from './salesReport.modal.js';
import { updateCostModeUI } from './salesReport.render.js';
import { cacheDom } from './salesReport.state.js';

export async function initSalesReport() {
  cacheDom();

  await setupAlertModal();

  setupYearSelect(YEAR_SELECT_OPTIONS);
  setupDateRangeFilter();
  setupSearchModals();
  setupTabs();
  updateCostModeUI();
  bindActions();

  // Carrega o relatório assim que a página estiver pronta.
  // Se os filtros estiverem vazios, o backend aplica os últimos 30 dias.
  await loadAndRenderSalesReport();
}

function boot() {
  initSalesReport().catch((error) => {
    console.error(
      '[salesReport] Erro ao inicializar o relatório de vendas:',
      error,
    );
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
