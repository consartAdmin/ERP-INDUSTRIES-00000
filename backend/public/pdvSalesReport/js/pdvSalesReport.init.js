import {
  downloadXmls,
  exportCsvCurrentView,
  loadReport,
  openPdf,
  resetFilters,
  setActiveTab
} from './pdvSalesReport.actions.js';

import { elements } from './pdvSalesReport.form.js';

function bindEvents() {
  elements.btnApplyFilters?.addEventListener('click', loadReport);
  elements.btnResetFilters?.addEventListener('click', resetFilters);

  elements.tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      setActiveTab(button.dataset.tab);
    });
  });

  elements.btnPdfFull?.addEventListener('click', () => {
    openPdf('full');
  });

  elements.btnPdfProducts?.addEventListener('click', () => {
    openPdf('customers');
  });

  elements.btnPdfOrders?.addEventListener('click', () => {
    openPdf('coupons');
  });

  elements.btnExportCsv?.addEventListener(
    'click',
    exportCsvCurrentView
  );

  elements.btnDownloadXmls?.addEventListener(
    'click',
    downloadXmls
  );
}

function init() {
  bindEvents();
  loadReport();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, {
    once: true
  });
} else {
  init();
}