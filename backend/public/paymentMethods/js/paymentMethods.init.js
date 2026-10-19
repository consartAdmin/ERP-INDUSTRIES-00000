// Payment Methods — module initialization

'use strict';

import {
  changePageSize,
  createPaymentMethod,
  getPaymentMethodsElements,
  handleFilterInput,
  handleStructuredFilter,
  handleTableClick,
  loadPaymentMethods,
  resetPaymentMethodsFilters,
  showNextPage,
  showPreviousPage,
  submitPaymentMethod,
} from './paymentMethods.actions.js';
import { getPaymentMethodsForm } from './paymentMethods.form.js';
import { setupPaymentMethodsModal } from './paymentMethods.modal.js';

let initialized = false;

export function initPaymentMethods() {
  if (initialized) return;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
}

function initialize() {
  if (initialized) return;
  if (!setupPaymentMethodsModal()) {
    console.error('[paymentMethods] Modal ou formulário não encontrado.');
    return;
  }

  const elements = getPaymentMethodsElements();
  const form = getPaymentMethodsForm();

  if (!elements.tbody || !form) {
    console.error('[paymentMethods] Estrutura HTML obrigatória não encontrada.');
    return;
  }

  initialized = true;
  elements.searchForm?.addEventListener('submit', event => event.preventDefault());
  elements.newButton?.addEventListener('click', createPaymentMethod);
  elements.filter?.addEventListener('input', handleFilterInput);
  const structuredFilters = [
    [elements.typeFilter, 'type'],
    [elements.installmentsFilter, 'installments'],
    [elements.statusFilter, 'status'],
    [elements.tpagFilter, 'tpag'],
  ];
  structuredFilters.forEach(([element, name]) => {
    if (!element) return;
    element.dataset.filter = name;
    element.addEventListener('change', handleStructuredFilter);
  });
  elements.clearFiltersButton?.addEventListener('click', resetPaymentMethodsFilters);
  elements.tbody.addEventListener('click', handleTableClick);
  elements.previousButton?.addEventListener('click', showPreviousPage);
  elements.nextButton?.addEventListener('click', showNextPage);
  elements.pageSize?.addEventListener('change', changePageSize);
  form.addEventListener('submit', submitPaymentMethod);

  loadPaymentMethods();
}

// HTML entry point:
// <script type="module" src="./paymentMethods.init.js"></script>
initPaymentMethods();
