'use strict';

import {
  exportExcel,
  exportPdf,
  loadAccounts,
  syncWithAsaas,
} from './accountsReceivable.actions.js';

import { createSortableTable }
  from '/public/includes/js/sortableTable.js';

import { bindFilters } from './accountsReceivable.filters.js';
import { bindForm } from './accountsReceivable.form.js';
import { bindReceiveModal } from './accountsReceivable.modal.js';
import { $ } from './accountsReceivable.utils.js';
import { openCustomersModalSearch } from './customersModalSearch.js';
import { Modal } from './modal.js';
import { initCashCategorySelects } from './accountsReceivable.categories.js';
import { initCashDocumentTypeSelects } from './accountsReceivable.documentTypes.js';
import { bindChartAccountPickers } from './accountsReceivable.chartAccountPicker.js';
import { initBankAccountSelects } from './accountsReceivable.bankAccounts.js';

async function initializeAccountsReceivable() {
  Modal.setup();

  try {
    await Promise.all([
      initCashCategorySelects(),
      initCashDocumentTypeSelects(),
      initBankAccountSelects(),
    ]);
  } catch (error) {
    console.error(
      '[accountsReceivable.init] Erro ao carregar opções do caixa:',
      error
    );
  }

  bindChartAccountPickers();

  const customerSearchInput = $('#arCustomerSearch');

  function openCustomerSearch() {
    openCustomersModalSearch({
      apiBase: window.API_BASE || window.apiBase || window.location.origin,
      onPick(customer) {
        const customerIdInput = $('#arCustomerId');
        const selectedCustomerInput = $('#arCustomerSearch');

        if (!customerIdInput || !selectedCustomerInput) {
          console.error(
            '[accountsReceivable.init] Campos do cliente não encontrados.'
          );
          return;
        }

        customerIdInput.value =
          customer.id ??
          customer.customer_id ??
          '';

        selectedCustomerInput.value =
          customer.trade_name ??
          customer.fantasy_name ??
          customer.name ??
          customer.legal_name ??
          customer.corporate_name ??
          customer.full_name ??
          '';

        customerIdInput.dispatchEvent(
          new Event('change', { bubbles: true })
        );

        selectedCustomerInput.dispatchEvent(
          new Event('change', { bubbles: true })
        );
      },
    });
  }

  customerSearchInput?.addEventListener('click', openCustomerSearch);
  customerSearchInput?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openCustomerSearch();
  });

  bindForm(loadAccounts);
  bindReceiveModal(loadAccounts);
  bindFilters();

  $('#btnSyncAsaas')?.addEventListener(
    'click',
    syncWithAsaas
  );

  $('#btnExportExcel')?.addEventListener(
    'click',
    exportExcel
  );

  $('#btnExportPdf')?.addEventListener(
    'click',
    exportPdf
  );

  createSortableTable({
    table: document.querySelector('.table'),

    // Usa data + hora internamente
    defaultColumn: 'created_at',
    defaultDirection: 'desc',

    allowedColumns: [
      'id',
      'customer_id',
      'customer_name',
      'account_bank',
      'document_type_name',
      'invoice_number',
      'issue_date',
      'created_at',
      'due_date',
      'status',
      'total',
      'received',
      'balance',
    ],

    onSort({ column, direction }) {
      return loadAccounts({
        page: 1,
        orderBy: column,
        orderDirection: direction,
      });
    },
  });

  loadAccounts();
}

if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    initializeAccountsReceivable,
    { once: true }
  );
} else {
  initializeAccountsReceivable();
}
