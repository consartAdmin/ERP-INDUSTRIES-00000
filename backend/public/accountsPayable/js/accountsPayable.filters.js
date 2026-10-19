// ╔══════════════════════════════════════════════════════════════════════╗
// ║ accountsPayable.filters.js — Filtros do Contas a Pagar             ║
// ║ PRODNEX ERP                                                        ║
// ║ - Lê filtros da interface                                          ║
// ║ - Integra o componente date-range-field                            ║
// ║ - Monta parâmetros para listagem e exportação                      ║
// ║ - Limpa os filtros e reinicia a paginação                           ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';


// ======================================================================
// IMPORTS
// ======================================================================

import {
  patchState,
  state,
} from './accountsPayable.state.js';

import {
  qs,
} from './accountsPayable.utils.js';


// ======================================================================
// CONSTANTS
// ======================================================================

const FILTER_PARAMETER_KEYS =
  Object.freeze([
    'search',
    'status',
    'fromDueDate',
    'toDueDate',
  ]);


// ======================================================================
// HELPERS
// ======================================================================

function appendActiveFilters(
  params
) {
  for (
    const key of
    FILTER_PARAMETER_KEYS
  ) {
    const value =
      state[key];

    if (
      value === undefined ||
      value === null ||
      value === ''
    ) {
      continue;
    }

    params.set(
      key,
      String(value)
    );
  }

  return params;
}


function getDueDateRange() {
  const component =
    qs('#filterDateRange');

  if (!component) {
    return {
      startDate: '',
      endDate: '',
    };
  }

  const value =
    component.value || {};

  return {
    startDate:
      String(
        value.startDate || ''
      ).trim(),

    endDate:
      String(
        value.endDate || ''
      ).trim(),
  };
}


// ======================================================================
// LIST PARAMETERS
// ======================================================================

export function buildListParams() {
  const params =
    new URLSearchParams({
      page:
        String(state.page),

      pageSize:
        String(state.pageSize),
    });

  if (state.sortColumn) {
    params.set('orderBy', `${state.sortColumn} ${state.sortDirection.toUpperCase()}`);
  }

  return appendActiveFilters(
    params
  );
}


// ======================================================================
// EXPORT PARAMETERS
// ======================================================================

export function buildExportParams() {
  const params =
    new URLSearchParams();

  if (state.sortColumn) {
    params.set('orderBy', `${state.sortColumn} ${state.sortDirection.toUpperCase()}`);
  }

  return appendActiveFilters(
    params
  );
}


// ======================================================================
// READ FILTER FIELDS
// ======================================================================

export function readFilters() {
  const {
    startDate,
    endDate,
  } = getDueDateRange();

  patchState({
    search:
      qs('#filterSearch')
        ?.value
        ?.trim() || '',

    status:
      qs('#filterStatus')
        ?.value || '',

    // Obsolete filters remain empty in the state for compatibility.
    month: '',
    year: '',

    fromDueDate:
      startDate,

    toDueDate:
      endDate,

    page: 1,
  });
}


// ======================================================================
// CLEAR FILTER FIELDS
// ======================================================================

export function clearFilterFields() {
  const filterSearch =
    qs('#filterSearch');

  const filterStatus =
    qs('#filterStatus');

  const filterDueDateRange =
    qs('#filterDateRange');


  // --------------------------------------------------------------------
  // Clear standard fields
  // --------------------------------------------------------------------

  if (filterSearch) {
    filterSearch.value = '';  
  }

  if (filterStatus) {
    filterStatus.value = '';
  }


  // --------------------------------------------------------------------
  // Clear date-range-field component
  // --------------------------------------------------------------------

  if (filterDueDateRange) {
    filterDueDateRange.value = {
      startDate: '',
      endDate: '',
    };
  }


  // --------------------------------------------------------------------
  // Reset filter state
  // --------------------------------------------------------------------

  patchState({
    search: '',
    status: '',
    month: '',
    year: '',
    fromDueDate: '',
    toDueDate: '',
    page: 1,
  });
}
