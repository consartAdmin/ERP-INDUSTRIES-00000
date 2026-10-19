// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: customersList.init.js                                         ║
// ║ MODULE: Customers List — Initialization                             ║
// ║ PRODNEX ERP                                                         ║
// ║ Application bootstrap and customers load-render orchestration       ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  fetchCustomers,
  loadSellerLinksForRows,
  preloadLookups,
} from './customersList.api.js';
import { bindActions } from './customersList.actions.js';
import {
  bindFilterEvents,
  fillFiltersCombos,
} from './customersList.filters.js';
import { readInitialForm } from './customersList.form.js';
import { showError } from './customersList.modal.js';
import {
  renderListMeta,
  renderRows,
} from './customersList.render.js';
import { state } from './customersList.state.js';
import { createSortableTable } from '/public/includes/js/sortableTable.js';

const SORTABLE_COLUMNS = Object.freeze([
  'customer_id',
  'trade_name',
  'tax_id',
  'email',
  'phone_number',
  'postal_code',
  'street_type',
  'street_name',
  'street_number',
  'address_complement',
  'neighborhood',
  'city',
  'state',
  'seller_name',
  'segment_name',
  'status_name',
  'is_active',
]);

let customersSortableTable = null;

document.addEventListener('DOMContentLoaded', () => {
  void boot();
});

async function boot() {
  try {
    readInitialForm();
    bindActions(loadAndRender);
    bindFilterEvents(loadAndRender);
    bindCustomersTableSort();
    await preloadLookups();
    fillFiltersCombos();
    await loadAndRender();
  } catch (error) {
    console.error('[customersList.boot]', error);
    showError('Erro', 'Não foi possível iniciar a lista de clientes.');
  }
}

function bindCustomersTableSort() {
  if (customersSortableTable) return;

  customersSortableTable = createSortableTable({
    table: '#customersTable',
    defaultColumn: state.orderBy,
    defaultDirection: state.orderDirection,
    allowedColumns: SORTABLE_COLUMNS,
    async onSort({ column, direction }) {
      state.orderBy = column;
      state.orderDirection = direction;
      state.page = 1;
      state.offset = 0;
      await loadAndRender();
    },
  });
}

export async function loadAndRender() {
  try {
    const data = await fetchCustomers();
    state.total = Number(data.total || 0);
    state.totalPages = Math.max(1, Math.ceil(state.total / state.limit));
    state.offset = Number(data.offset || 0);
    state.page = Math.max(
      1,
      Math.floor(state.offset / state.limit) + 1
    );

    if (state.page > state.totalPages) {
      state.page = state.totalPages;
      state.offset = (state.page - 1) * state.limit;
      return loadAndRender();
    }

    const rows = Array.isArray(data.rows) ? data.rows : [];
    await loadSellerLinksForRows(rows);
    renderRows(rows);
    renderListMeta();
  } catch (error) {
    console.error('[customersList.loadAndRender]', error);
    showError('Erro', 'Não foi possível carregar clientes.');
  }
}
