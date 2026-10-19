// ╔════════════════════════════════════════════════════════════╗
// ║ units.init.js — Inicialização do módulo Unidades              ║
// ╚════════════════════════════════════════════════════════════╝

import { UNITS_CONFIG } from './units.config.js';
import { state } from './units.state.js';
import {
  loadUnits,
  handleSearch,
  handleIncludeInactive,
  handlePreviousPage,
  handleNextPage,
  handlePageSize,
  handleNew,
  handleEditById,
  handleDeleteById,
  handleSave,
} from './units.actions.js';
import { closeUnitModal } from './units.modal.js';

function $(id) {
  return document.getElementById(id);
}

function debounce(fn, delay) {
  let timer = null;

  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function cacheRefs() {
  state.refs = {
    tableBody: $('unitsTableBody'),
    tableInfo: $('unitsTableInfo'),
    summaryTotal: $('unitsSummaryTotal'),
    summaryActive: $('unitsSummaryActive'),
    summaryInactive: $('unitsSummaryInactive'),
    pageInfo: $('unitsPageInfo'),
    previous: $('btnPreviousPage'),
    next: $('btnNextPage'),

    search: $('searchUnit'),
    includeInactive: $('filterIncludeInactive'),
    pageSize: $('unitsRowsPerPage'),

    newButton: $('btnNewUnit'),

    modal: $('unitModal'),
    modalTitle: $('unitModalTitle'),
    modalCaption: $('unitModalCaption'),
    closeModal: $('btnCloseUnitModal'),
    cancelModal: $('btnCancelUnit'),

    form: $('unitForm'),
    formMessage: $('unitFormMessage'),
    saveButton: $('btnSaveUnit'),

    inputId: $('unitId'),
    inputUnit: $('unit'),
    inputDescription: $('description'),
    inputFator: $('fator'),
    inputIsActive: $('is_active'),
  };
}

function bindEvents() {
  const refs = state.refs;

  refs.newButton?.addEventListener('click', handleNew);
  refs.closeModal?.addEventListener('click', closeUnitModal);
  refs.cancelModal?.addEventListener('click', closeUnitModal);

  refs.modal?.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeUnitModal();
  });

  refs.modal?.addEventListener('click', (event) => {
    if (event.target === refs.modal) {
      closeUnitModal();
    }
  });

  refs.form?.addEventListener('submit', handleSave);

  refs.search?.addEventListener(
    'input',
    debounce((event) => handleSearch(event.target.value), UNITS_CONFIG.searchDebounceMs)
  );

  refs.includeInactive?.addEventListener('change', (event) => {
    handleIncludeInactive(event.target.checked);
  });

  refs.previous?.addEventListener('click', handlePreviousPage);
  refs.next?.addEventListener('click', handleNextPage);

  refs.pageSize?.addEventListener('change', (event) => {
    handlePageSize(event.target.value);
  });

  refs.tableBody?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-unit-action]');
    if (!button) return;

    const id = button.dataset.unitId;
    const action = button.dataset.unitAction;

    if (action === 'edit') {
      handleEditById(id);
      return;
    }

    if (action === 'delete') {
      handleDeleteById(id);
    }
  });
}

function initializeDefaults() {
  state.pageSize = UNITS_CONFIG.defaultPageSize;

  if (state.refs.pageSize) {
    state.refs.pageSize.value = String(UNITS_CONFIG.defaultPageSize);
  }

  if (state.refs.includeInactive) {
    state.refs.includeInactive.checked = false;
  }
}

async function init() {
  cacheRefs();
  initializeDefaults();
  bindEvents();
  await loadUnits();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
