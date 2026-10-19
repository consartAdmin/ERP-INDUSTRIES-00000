import { state } from './accountsReceivableReports.state.js';

import {
  fetchSummary,
  fetchSales,
  exportUrl,
} from './accountsReceivableReports.api.js';

import {
  renderSummary,
  renderRows,
  renderPagination,
  showMessage,
} from './accountsReceivableReports.render.js';

const $ = (selector) => document.querySelector(selector);

function filters() {
  return {
    fromDate: $('#arrFromDate').value,
    toDate: $('#arrToDate').value,
    receivableStatus: $('#arrStatus').value,
    search: $('#arrSearch').value.trim(),
    onlyDivergences: $('#arrOnlyDivergences').checked,
    page: state.page,
    pageSize: state.pageSize,
  };
}

async function load() {
  state.loading = true;
  showMessage('');
  renderPagination(state);

  try {
    const current = filters();

    const [summary, sales] = await Promise.all([
      fetchSummary(current),
      fetchSales(current),
    ]);

    state.total = Number(sales.total || 0);
    state.totalPages = Number(sales.totalPages || 1);
    state.page = Number(sales.page || 1);

    renderSummary(summary.data);
    renderRows(sales.items);
  } catch (error) {
    renderRows([]);
    showMessage(error.message);
  } finally {
    state.loading = false;
    renderPagination(state);
  }
}

$('#arrApply').addEventListener('click', () => {
  state.page = 1;
  load();
});

$('#arrClear').addEventListener('click', () => {
  $('#arrFromDate').value = '';
  $('#arrToDate').value = '';
  $('#arrStatus').value = '';
  $('#arrSearch').value = '';
  $('#arrOnlyDivergences').checked = false;

  const dateRange = $('#arrSaleDateRange');

  if (typeof dateRange?.clear === 'function') {
    dateRange.clear();
  } else {
    dateRange?.setAttribute('value-start', '');
    dateRange?.setAttribute('value-end', '');
  }

  state.page = 1;
  load();
});

$('#arrSearch').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    state.page = 1;
    load();
  }
});

$('#btnPreviousPage').addEventListener('click', () => {
  if (state.page > 1) {
    state.page -= 1;
    load();
  }
});

$('#btnNextPage').addEventListener('click', () => {
  if (state.page < state.totalPages) {
    state.page += 1;
    load();
  }
});

$('#apRowsPerPage').addEventListener('change', (event) => {
  state.pageSize = Number(event.target.value);
  state.page = 1;
  load();
});

$('#arrExport').addEventListener('click', () => {
  const current = filters();
  delete current.page;
  delete current.pageSize;
  window.location.href = exportUrl(current);
});

load();
