// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ accountsReceivable.filters.js — Filtros de Contas a Receber             ║
// ║ Controla pesquisa, status, vencimento, paginação e limpeza dos filtros.  ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import { loadAccounts } from './accountsReceivable.actions.js';
import { state } from './accountsReceivable.state.js';
import { $ } from './accountsReceivable.utils.js';

/**
 * Copies the date-range component value to the original hidden inputs.
 *
 * This preserves compatibility with loadAccounts() and any existing code
 * that reads #filterFromDue and #filterToDue.
 */
function syncDateRange(event) {
  const dateRange = $('#filterDateRange');
  const fromDue = $('#filterFromDue');
  const toDue = $('#filterToDue');

  if (!dateRange) {
    return;
  }

  const componentValue = dateRange.value || {};
  const eventValue = event?.detail || {};
  const startDate = eventValue.startDate ?? eventValue.start_date ??
    componentValue.startDate ?? componentValue.start_date ?? '';
  const endDate = eventValue.endDate ?? eventValue.end_date ??
    componentValue.endDate ?? componentValue.end_date ?? '';

  if (fromDue) {
    fromDue.value = startDate;
  }

  if (toDue) {
    toDue.value = endDate;
  }
}

/**
 * Applies the current filters.
 */
async function applyFilters(event) {
  event?.preventDefault();

  syncDateRange(event);

  state.page = 1;

  await loadAccounts();
}

/**
 * Clears every filter and reloads the account list.
 */
async function clearFilters() {
  const dateRange = $('#filterDateRange');

  for (const id of [
    'filterSearch',
    'filterStatus',
    'filterBankAccount',
    'filterDateType',
    'filterFromDue',
    'filterToDue'
  ]) {
    const element = $(`#${id}`);

    if (element) {
      element.value = '';
    }
  }

  if (dateRange && typeof dateRange.clear === 'function') {
    dateRange.clear();
  }

  const dateType = $('#filterDateType');
  if (dateType) dateType.value = 'due_date';

  state.page = 1;

  await loadAccounts();

  $('#filterSearch')?.focus();
}

/**
 * Registers the accounts-receivable filter events.
 */
export function bindFilters() {
  const dateRange = $('#filterDateRange');

  $('#filterForm')?.addEventListener(
    'submit',
    applyFilters
  );

  $('#filterSearch')?.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Enter') {
        applyFilters(event);
      }
    }
  );

  $('#btnClearFilters')?.addEventListener(
    'click',
    clearFilters
  );

  dateRange?.addEventListener(
    'range-change',
    (event) => {
      syncDateRange(event);
    }
  );

  $('#apRowsPerPage')?.addEventListener(
    'change',
    async (event) => {
      const size = Number.parseInt(
        event.target.value,
        10
      );

      state.pageSize =
        Number.isInteger(size) && size > 0
          ? size
          : 20;

      state.page = 1;

      await loadAccounts();
    }
  );

  $('#btnPreviousPage')?.addEventListener(
    'click',
    async () => {
      if (state.page <= 1) {
        return;
      }

      state.page -= 1;

      await loadAccounts();
    }
  );

  $('#btnNextPage')?.addEventListener(
    'click',
    async () => {
      if (state.page >= state.totalPages) {
        return;
      }

      state.page += 1;

      await loadAccounts();
    }
  );

  syncDateRange();
}
