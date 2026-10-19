// ╔══════════════════════════════════════════════════════════════════════╗
// ║ conciliationSalesxStock.init.js                                    ║
// ║ PRODNEX ERP                                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import '/public/includes/js/date-range-field.js';

import {
  bindActions,
  initSortableTable,
  loadReport,
  setDefaultDates,
} from './conciliationSalesxStock.actions.js';

function init() {
  setDefaultDates();
  bindActions();
  initSortableTable();
  void loadReport();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
