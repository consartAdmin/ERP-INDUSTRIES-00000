// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: fiscalClassification.init.js                                 ║
// ║ MODULE: Fiscal Classification — Bootstrap                          ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  applyFilters,
  goToNextPage,
  goToPreviousPage,
  loadClassifications,
  newClassification,
  saveClassification,
} from './fiscalClassification.actions.js';
import {
  clearClassificationForm,
  getClassificationForm,
} from './fiscalClassification.form.js';
import { loadFiscalProfiles } from './fiscalClassification.profiles.js';
import { activateTab } from './fiscalClassification.render.js';
import { $, $$ } from './fiscalClassification.utils.js';

function bindEvents() {
  $$('.tab').forEach((button) => {
    button.addEventListener('click', () => activateTab(button.dataset.tab));
  });

  $('#btnNovo')?.addEventListener('click', newClassification);
  $('#btnBuscar')?.addEventListener('click', applyFilters);
  $('#btnPrev')?.addEventListener('click', goToPreviousPage);
  $('#btnNext')?.addEventListener('click', goToNextPage);
  $('#btnLimpar')?.addEventListener('click', clearClassificationForm);
  $('#pageSize')?.addEventListener('change', (event) => {
    state.pageSize = Number(event.target.value) || 50;
    state.page = 1;
    loadClassifications();
  });
  getClassificationForm()?.addEventListener('submit', saveClassification);

  $('#busca')?.addEventListener('keyup', (event) => {
    if (event.key === 'Enter') applyFilters();
  });
}

async function bootFiscalClassification() {
  console.log('[fiscalClassification] Init');
  bindEvents();
  clearClassificationForm();
  activateTab('list');
  await loadFiscalProfiles();
  await loadClassifications();
}

document.addEventListener('DOMContentLoaded', bootFiscalClassification);
