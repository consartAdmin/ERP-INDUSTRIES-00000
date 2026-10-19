// ╔══════════════════════════════════════════════════════════════════════╗
// ║ accountsPayable.init.js — Inicialização do Contas a Pagar          ║
// ║ PRODNEX ERP                                                        ║
// ║ - Registra o componente date-range-field                           ║
// ║ - Inicializa eventos, paginação, categorias e tipos de documento   ║
// ║ - Centraliza a inicialização do módulo frontend                     ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';


// ======================================================================
// CUSTOM COMPONENTS
// ======================================================================

// Registers the <date-range-field> custom element
import '/public/includes/js/date-range-field.js';

// ======================================================================
// MODULE IMPORTS
// ======================================================================

import {
  applyFilters,
  batchAccounts,
  clearFilters,
  downloadAccounts,
  handleTableAction,
  loadList,
  newAccount,
  nextPage,
  previousPage,
  submitPayment,
} from './accountsPayable.actions.js';

import {
  ensurePageSizeControl,
  initPayAttachmentDropzone,
} from './accountsPayable.form.js';

import {
  closePayModal,
  loadCashDocumentTypes,
  openDocumentTypesModal,
  searchPayChartAccount,
  clearPayChartAccount,
} from './accountsPayable.modal.js';

import {
  listCashCategories,
  listCashSubcategories,
} from './accountsPayable.api.js';

import {
  state,
} from './accountsPayable.state.js';

import {
  qs,
} from './accountsPayable.utils.js';

import createSortableTable from './sortableTable.js';


// ======================================================================
// CASH LOOKUPS
// ======================================================================

async function initCashLookups() {
  const category =
    qs('#pay_categoria');

  const subcategory =
    qs('#pay_subcategoria');

  if (!category) {
    return;
  }


  // --------------------------------------------------------------------
  // Load categories
  // --------------------------------------------------------------------

  try {
    state.cashCategories =
      await listCashCategories();

    const placeholder =
      category
        .querySelector('option')
        ?.cloneNode(true) ||
      new Option('(opcional)', '');

    category.replaceChildren(
      placeholder
    );

    state.cashCategories
      .filter(
        (item) =>
          item.is_active !== false
      )
      .forEach(
        (item) => {
          category.add(
            new Option(
              item.nome,
              String(item.id)
            )
          );
        }
      );
  } catch (error) {
    console.error(
      '[accountsPayable] Erro ao carregar categorias:',
      error
    );
  }


  // --------------------------------------------------------------------
  // Load subcategories when the category changes
  // --------------------------------------------------------------------

  category.addEventListener(
    'change',
    async () => {
      if (!subcategory) {
        return;
      }

      const placeholder =
        subcategory
          .querySelector('option')
          ?.cloneNode(true) ||
        new Option('(opcional)', '');

      subcategory.replaceChildren(
        placeholder
      );

      if (!category.value) {
        return;
      }

      try {
        const cachedRows =
          state.cashSubcategoriesByCategory[
          category.value
          ];

        const rows =
          cachedRows ||
          await listCashSubcategories(
            category.value
          );

        state.cashSubcategoriesByCategory[
          category.value
        ] = rows;

        rows
          .filter(
            (item) =>
              item.is_active !== false
          )
          .forEach(
            (item) => {
              subcategory.add(
                new Option(
                  item.nome,
                  String(item.id)
                )
              );
            }
          );
      } catch (error) {
        console.error(
          '[accountsPayable] Erro ao carregar subcategorias:',
          error
        );
      }
    }
  );
}


// ======================================================================
// EVENTS
// ======================================================================

function bindEvents(pageSize) {

  // --------------------------------------------------------------------
  // Filters
  // --------------------------------------------------------------------

  qs('#filterForm')
    ?.addEventListener(
      'submit',
      (event) => {
        event.preventDefault();

        void applyFilters();
      }
    );

  qs('#filterSearch')
    ?.addEventListener(
      'keydown',
      (event) => {
        if (event.key !== 'Enter') {
          return;
        }

        event.preventDefault();

        void applyFilters();
      }
    );

  qs('#btnApplyFilters')
    ?.addEventListener(
      'click',
      () => {
        void applyFilters();
      }
    );

  qs('#btnClearFilters')
    ?.addEventListener(
      'click',
      () => {
        void clearFilters();
      }
    );


  // --------------------------------------------------------------------
  // Export
  // --------------------------------------------------------------------

  qs('#btnExportPdf')
    ?.addEventListener(
      'click',
      () => {
        void downloadAccounts('pdf');
      }
    );

  qs('#btnExportExcel')
    ?.addEventListener(
      'click',
      () => {
        void downloadAccounts('excel');
      }
    );


  // --------------------------------------------------------------------
  // Pagination
  // --------------------------------------------------------------------

  pageSize
    ?.addEventListener(
      'change',
      () => {
        state.pageSize =
          Number(pageSize.value) || 50;

        state.page = 1;

        void loadList();
      }
    );

  qs('#btnPreviousPage')
    ?.addEventListener(
      'click',
      () => {
        void previousPage();
      }
    );

  qs('#btnNextPage')
    ?.addEventListener(
      'click',
      () => {
        void nextPage();
      }
    );


  // --------------------------------------------------------------------
  // Main actions
  // --------------------------------------------------------------------

  qs('#btnCashDocumentTypes')
    ?.addEventListener(
      'click',
      () => {
        void openDocumentTypesModal();
      }
    );

  qs('#btnBatch')
    ?.addEventListener(
      'click',
      () => {
        void batchAccounts();
      }
    );

  qs('#btnNew')
    ?.addEventListener(
      'click',
      () => {
        void newAccount();
      }
    );


  // --------------------------------------------------------------------
  // Table actions
  // --------------------------------------------------------------------

  qs('#apTableBody')
    ?.addEventListener(
      'click',
      handleTableAction
    );


  // --------------------------------------------------------------------
  // Payment modal
  // --------------------------------------------------------------------
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;

    const modal = document.getElementById('payModal');

    if (!modal?.classList.contains('is-open')) return;

    event.preventDefault();
    closePayModal();
  });

  qs('#fecharModalPagar')
    ?.addEventListener(
      'click',
      closePayModal
    );

  qs('#btnCancelarPagamento')
    ?.addEventListener(
      'click',
      closePayModal
    );

  qs('#payForm')
    ?.addEventListener(
      'submit',
      submitPayment
    );

  qs('#btnPaySearchChartAccount')
    ?.addEventListener('click', searchPayChartAccount);

  qs('#pay_chart_account_display')
    ?.addEventListener('click', searchPayChartAccount);

  qs('#btnPayClearChartAccount')
    ?.addEventListener('click', clearPayChartAccount);
}


// ======================================================================
// INITIALIZATION
// ======================================================================

async function init() {
  const root =
    document.documentElement;

  if (
    root.dataset.accountsPayableInitialized ===
    'true'
  ) {
    return;
  }

  root.dataset.accountsPayableInitialized =
    'true';

  console.log(
    '[accountsPayable] Init modular'
  );

  const pageSize =
    ensurePageSizeControl();

  initPayAttachmentDropzone();

  bindEvents(pageSize);

  createSortableTable({
    table: '#accountsPayableTable',
    defaultColumn: state.sortColumn,
    defaultDirection: state.sortDirection,
    allowedColumns: [
      'id',
      'supplier_id',
      'supplier_name',
      'invoice_number',
      'issue_date',
      'due_date',
      'status',
      'total_value',
      'amount_paid',
      'balance',
    ],
    onSort: async ({ column, direction }) => {
      state.sortColumn = column;
      state.sortDirection = direction;
      state.page = 1;
      await loadList();
    },
  });

  await Promise.allSettled([
    initCashLookups(),
    loadCashDocumentTypes(),
  ]);

  await loadList();
}


// ======================================================================
// DOCUMENT READY
// ======================================================================

if (
  document.readyState ===
  'loading'
) {
  document.addEventListener(
    'DOMContentLoaded',
    init,
    {
      once: true,
    }
  );
} else {
  void init();
}
