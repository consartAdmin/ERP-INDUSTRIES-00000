// ╔══════════════════════════════════════════════════════════════════════╗
// ║ customersList.sortable.js — Ordenação da listagem de clientes      ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { createSortableTable } from '../sortableTable.js';
import { resetPagination, state } from './customersList.state.js';

const ALLOWED_COLUMNS = Object.freeze([
  'customer_id',
  'trade_name',
  'tax_id',
  'email',
  'phone_number',
  'is_active',
]);

let sortableTable = null;

export function bindCustomersTableSort(loadAndRender) {
  if (sortableTable) return sortableTable;

  sortableTable = createSortableTable({
    table: '#customersTable',
    defaultColumn: state.orderBy,
    defaultDirection: state.orderDirection,
    allowedColumns: ALLOWED_COLUMNS,
    async onSort({ column, direction }) {
      state.orderBy = column;
      state.orderDirection = direction;
      resetPagination();
      await loadAndRender();
    },
  });

  return sortableTable;
}
