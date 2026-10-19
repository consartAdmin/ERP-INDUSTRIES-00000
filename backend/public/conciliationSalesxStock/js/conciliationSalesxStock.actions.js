// ╔══════════════════════════════════════════════════════════════════════╗
// ║ conciliationSalesxStock.actions.js                                 ║
// ║ PRODNEX ERP                                                        ║
// ║ Filtros, paginação, exportação e ordenação                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  fetchReconciliation,
  exportReconciliationUrl,
} from './conciliationSalesxStock.api.js';

import {
  renderReport,
  showMessage,
} from './conciliationSalesxStock.render.js';

import {
  state,
} from './conciliationSalesxStock.state.js';

import {
  createSortableTable,
} from '/public/includes/js/sortableTable.js';

const DEFAULT_SORT_COLUMN = 'movement_date';
const DEFAULT_SORT_DIRECTION = 'asc';

const SORTABLE_COLUMNS = Object.freeze([
  'sku',
  'description',
  'movement_type',
  'invoice_number',
  'movement_date',
  'movement_quantity',
  'stock_after',
  'quantity_to_buy',
]);

const field = (id) => document.getElementById(id);

let sortableTable = null;

function ensureSortState() {
  if (!SORTABLE_COLUMNS.includes(String(state.sortColumn || ''))) {
    state.sortColumn = DEFAULT_SORT_COLUMN;
  }

  state.sortDirection =
    String(state.sortDirection || DEFAULT_SORT_DIRECTION).trim().toLowerCase() === 'desc'
      ? 'desc'
      : 'asc';
}

function params() {
  ensureSortState();

  const dateRange = field('csDateRange')?.value || {};

  return new URLSearchParams({
    dateStart: dateRange.startDate || '',
    dateEnd: dateRange.endDate || '',
    search: field('csSearch').value.trim(),
    movementType: field('csMovementType').value,
    viewMode: field('csViewMode').value,
    onlyNeedBuy: String(field('csOnlyNeedBuy').checked),
    sortColumn: state.sortColumn,
    sortDirection: state.sortDirection,
    limit: String(state.pageSize),
    offset: String((state.page - 1) * state.pageSize),
  });
}

function exportParams() {
  const output = params();
  output.delete('limit');
  output.delete('offset');
  return output;
}

function downloadReport(format) {
  window.location.assign(
    exportReconciliationUrl(format, exportParams()),
  );
}

export async function loadReport() {
  if (state.loading) return;

  state.loading = true;
  showMessage('');

  try {
    const payload = await fetchReconciliation(params());

    state.total = Number(payload.total || 0);

    renderReport(payload, state);
    sortableTable?.refresh();
    showMessage('');
  } catch (error) {
    showMessage(
      error?.message || 'Erro ao carregar relatório.',
      true,
    );
  } finally {
    state.loading = false;
  }
}

export function initSortableTable() {
  if (sortableTable) {
    sortableTable.destroy();
    sortableTable = null;
  }

  ensureSortState();

  sortableTable = createSortableTable({
    table: '#csTable',
    defaultColumn: state.sortColumn,
    defaultDirection: state.sortDirection,
    allowedColumns: SORTABLE_COLUMNS,
    sortOnInit: false,

    async onSort({ column, direction }) {
      state.sortColumn = column;
      state.sortDirection = direction;
      state.page = 1;

      await loadReport();
    },

    onError(error) {
      console.error(
        '[conciliationSalesxStock][sortableTable]',
        error,
      );

      showMessage(
        error?.message || 'Erro ao ordenar a tabela.',
        true,
      );
    },
  });

  return sortableTable;
}

export function bindActions() {
  field('csApply').addEventListener('click', () => {
    state.page = 1;
    void loadReport();
  });

  field('csClear').addEventListener('click', () => {
    field('csSearch').value = '';
    field('csOnlyNeedBuy').checked = true;
    field('csMovementType').value = 'all';
    field('csViewMode').value = 'operation';

    setDefaultDates();

    state.page = 1;
    state.sortColumn = DEFAULT_SORT_COLUMN;
    state.sortDirection = DEFAULT_SORT_DIRECTION;

    void sortableTable?.setSort(
      state.sortColumn,
      state.sortDirection,
      { notify: false },
    );

    void loadReport();
  });

  field('pagAnterior').addEventListener('click', () => {
    if (state.page > 1) {
      state.page -= 1;
      void loadReport();
    }
  });

  field('pagProxima').addEventListener('click', () => {
    const pages = Math.max(
      Math.ceil(
        Number(state.total || 0) /
        Math.max(Number(state.pageSize || 50), 1),
      ),
      1,
    );

    if (state.page < pages) {
      state.page += 1;
      void loadReport();
    }
  });

  field('apRowsPerPage').addEventListener('change', (event) => {
    state.pageSize = Number(event.target.value);
    state.page = 1;
    void loadReport();
  });

  field('csViewMode').addEventListener('change', () => {
    state.page = 1;
    void loadReport();
  });

  field('csMovementType').addEventListener('change', () => {
    state.page = 1;
    void loadReport();
  });

  field('csDateRange').addEventListener('range-change', () => {
    state.page = 1;
  });

  field('csSearch').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      state.page = 1;
      void loadReport();
    }
  });

  field('btnExportPdf').addEventListener(
    'click',
    () => downloadReport('pdf'),
  );

  field('btnExportExcel').addEventListener(
    'click',
    () => downloadReport('excel'),
  );
}

export function setDefaultDates() {
  const today = new Date();
  const past = new Date();

  past.setDate(today.getDate() - 30);

  const localISO = (date) => {
    const offset = date.getTimezoneOffset() * 60000;

    return new Date(
      date.getTime() - offset,
    )
      .toISOString()
      .slice(0, 10);
  };

  const dateRange = field('csDateRange');

  if (!dateRange) {
    throw new Error(
      'Componente de período csDateRange não encontrado no HTML.',
    );
  }

  dateRange.value = {
    startDate: localISO(past),
    endDate: localISO(today),
  };
}
