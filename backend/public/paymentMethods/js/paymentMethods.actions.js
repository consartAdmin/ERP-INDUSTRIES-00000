// Payment Methods — user and data actions

'use strict';

import {
  deletePaymentMethod,
  getPaymentMethod,
  listPaymentMethods,
  savePaymentMethod,
  setPaymentMethodActive,
} from './paymentMethods.api.js';
import { SELECTORS } from './paymentMethods.config.js';
import { readPaymentMethodsForm } from './paymentMethods.form.js';
import { closePaymentMethodsModal, openPaymentMethodsModal } from './paymentMethods.modal.js';
import { renderPaymentMethods, renderTableMessage } from './paymentMethods.render.js';
import {
  paymentMethodsState,
  clearFilters,
  setFilter,
  setFilteredRows,
  setPage,
  setPageSize,
  setQuery,
  setRows,
} from './paymentMethods.state.js';
import { $, escapeHtml, normalizeListResponse, normalizePaymentMethod } from './paymentMethods.utils.js';
import { validatePaymentMethod } from './paymentMethods.validation.js';

export async function loadPaymentMethods() {
  renderTableMessage('Carregando...');

  try {
    const json = await listPaymentMethods();
    setRows(normalizeListResponse(json));
    populateFilterOptions();
    applyPaymentMethodsFilter();
  } catch (error) {
    console.error('[paymentMethods][list]', error);
    renderTableMessage('Erro ao carregar dados.');
  }
}

export function createPaymentMethod() {
  openPaymentMethodsModal();
}

export async function editPaymentMethod(id) {
  if (!id) return alert('ID inválido para edição.');

  try {
    const json = await getPaymentMethod(id);
    openPaymentMethodsModal(normalizePaymentMethod(json?.data || json));
  } catch (error) {
    console.error('[paymentMethods][edit]', error);
    alert(`Falha ao carregar: ${error.message}`);
  }
}

export async function removePaymentMethod(id) {
  if (!id) return alert('ID inválido para exclusão.');
  if (!confirm('Excluir esta forma de pagamento?')) return;

  try {
    await deletePaymentMethod(id);
    await loadPaymentMethods();
  } catch (error) {
    console.error('[paymentMethods][delete]', error);
    alert(`Falha ao excluir: ${error.message}`);
  }
}

export async function togglePaymentMethod(id, currentActive) {
  if (!id) return alert('ID inválido.');

  try {
    await setPaymentMethodActive(id, !currentActive);
    await loadPaymentMethods();
  } catch (error) {
    console.error('[paymentMethods][toggle]', error);
    alert(`Falha ao alterar status: ${error.message}`);
  }
}

export async function submitPaymentMethod(event) {
  event.preventDefault();

  const formData = readPaymentMethodsForm();
  if (!formData) return;

  const validation = validatePaymentMethod(formData.payload);
  if (!validation.valid) {
    alert(validation.errors.join('\n'));
    return;
  }

  try {
    const json = await savePaymentMethod(formData.id, formData.payload);
    closePaymentMethodsModal();
    await loadPaymentMethods();
    window.dispatchEvent(new CustomEvent('paymentMethods:saved', {
      detail: json?.data || json,
    }));
  } catch (error) {
    console.error('[paymentMethods][save]', error);
    alert(`Falha ao salvar: ${error.message}`);
  }
}

export function applyPaymentMethodsFilter() {
  const query = paymentMethodsState.query.toLocaleLowerCase('pt-BR');
  const filters = paymentMethodsState.filters;
  const rows = paymentMethodsState.rows.filter(raw => {
      const row = normalizePaymentMethod(raw);
      const matchesQuery = !query || [row.name, row.type, row.nfe_tpag]
        .some(value => String(value).toLocaleLowerCase('pt-BR').includes(query));
      const matchesType = !filters.type || String(row.type) === filters.type;
      const matchesInstallments = !filters.installments
        || String(row.installments) === filters.installments;
      const matchesStatus = !filters.status
        || (filters.status === 'active' ? row.active : !row.active);
      const matchesTpag = !filters.tpag || String(row.nfe_tpag) === filters.tpag;

      return matchesQuery && matchesType && matchesInstallments && matchesStatus && matchesTpag;
    });

  setFilteredRows(rows);
  setPage(1);
  renderPaymentMethods();
}

function fillSelect(selector, values, emptyLabel) {
  const select = $(selector);
  if (!select) return;
  const currentValue = select.value;
  select.innerHTML = `<option value="">${emptyLabel}</option>`
    + values.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
  select.value = values.map(String).includes(currentValue) ? currentValue : '';
}

export function populateFilterOptions() {
  const rows = paymentMethodsState.rows.map(normalizePaymentMethod);
  const unique = (field, numeric = false) => [...new Set(rows.map(row => row[field]))]
    .filter(value => value !== '' && value !== null && value !== undefined)
    .sort(numeric ? (a, b) => Number(a) - Number(b) : (a, b) => String(a).localeCompare(String(b), 'pt-BR'));

  fillSelect(SELECTORS.typeFilter, unique('type'), 'Todos');
  fillSelect(SELECTORS.installmentsFilter, unique('installments', true), 'Todas');
  fillSelect(SELECTORS.tpagFilter, unique('nfe_tpag', true), 'Todos');
}

export function handleFilterInput(event) {
  setQuery(event.target.value);
  applyPaymentMethodsFilter();
}

export function handleStructuredFilter(event) {
  setFilter(event.target.dataset.filter, event.target.value);
  applyPaymentMethodsFilter();
}

export function resetPaymentMethodsFilters() {
  clearFilters();
  const elements = getPaymentMethodsElements();
  [elements.filter, elements.typeFilter, elements.installmentsFilter,
    elements.statusFilter, elements.tpagFilter].forEach(element => {
    if (element) element.value = '';
  });
  applyPaymentMethodsFilter();
}

export function handleTableClick(event) {
  const editButton = event.target.closest?.('[data-edit]');
  if (editButton) return editPaymentMethod(editButton.dataset.edit);

  const deleteButton = event.target.closest?.('[data-del]');
  if (deleteButton) return removePaymentMethod(deleteButton.dataset.del);

  const toggleButton = event.target.closest?.('[data-toggle]');
  if (toggleButton) {
    return togglePaymentMethod(toggleButton.dataset.toggle, toggleButton.dataset.active === 'true');
  }
}

export function showPreviousPage() {
  setPage(paymentMethodsState.page - 1);
  renderPaymentMethods();
}

export function showNextPage() {
  setPage(paymentMethodsState.page + 1);
  renderPaymentMethods();
}

export function changePageSize(event) {
  setPageSize(event.target.value);
  renderPaymentMethods();
}

export function getPaymentMethodsElements() {
  return {
    searchForm: $(SELECTORS.searchForm),
    newButton: $(SELECTORS.newButton),
    filter: $(SELECTORS.filter),
    typeFilter: $(SELECTORS.typeFilter),
    installmentsFilter: $(SELECTORS.installmentsFilter),
    statusFilter: $(SELECTORS.statusFilter),
    tpagFilter: $(SELECTORS.tpagFilter),
    clearFiltersButton: $(SELECTORS.clearFiltersButton),
    tbody: $(SELECTORS.tableBody),
    previousButton: $(SELECTORS.previousButton),
    nextButton: $(SELECTORS.nextButton),
    pageSize: $(SELECTORS.pageSize),
  };
}
