import { DEFAULT_PAGE_SIZE } from './suppliers.config.js';
export const suppliersState = {
  page: 1, limit: DEFAULT_PAGE_SIZE, total: 0, search: '',
  sort: 'supplier_id', dir: 'asc', currentSupplierId: null, sortableTable: null,
};
