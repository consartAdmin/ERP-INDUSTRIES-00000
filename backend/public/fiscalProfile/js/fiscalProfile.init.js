// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: fiscalProfile.init.js                                         ║
// ║ MODULE: Fiscal Profile — Initialization                             ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  loadProfiles,
  newProfile,
  nextPage,
  previousPage,
  returnToList,
  showListPage,
  submitProfile,
} from './fiscalProfile.actions.js';
import { syncFiltersFromDom } from './fiscalProfile.filters.js';
import { resetForm } from './fiscalProfile.form.js';
import { dom, state } from './fiscalProfile.state.js';

function searchProfiles() {
  syncFiltersFromDom();
  state.page = 1;
  loadProfiles();
}

function bindNavigation() {
  dom.newButton?.addEventListener('click', newProfile);
  dom.backToListButton?.addEventListener('click', returnToList);
}

function bindFilters() {
  dom.searchButton?.addEventListener('click', searchProfiles);

  dom.searchInput?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;

    event.preventDefault();
    searchProfiles();
  });
}

function bindPagination() {
  dom.previousButton?.addEventListener('click', previousPage);
  dom.nextButton?.addEventListener('click', nextPage);
  dom.pageSizeSelect?.addEventListener('change', (event) => {
    state.pageSize = Number(event.target.value) || 50;
    state.page = 1;
    loadProfiles();
  });
}

function bindForm() {
  dom.clearButton?.addEventListener('click', resetForm);
  dom.form?.addEventListener('submit', submitProfile);
}

function init() {
  console.log('[fiscalProfile] Init');

  bindNavigation();
  bindFilters();
  bindPagination();
  bindForm();

  resetForm();
  showListPage({ scroll: false });
  loadProfiles();
}

document.addEventListener('DOMContentLoaded', init, { once: true });
