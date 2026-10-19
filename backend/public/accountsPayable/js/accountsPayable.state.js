'use strict';

import { DEFAULT_PAGE_SIZE } from './accountsPayable.config.js';

export const state = {
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  total: 0,
  search: '',
  status: '',
  month: '',
  year: String(new Date().getFullYear()),
  fromDueDate: '',
  toDueDate: '',
  sortColumn: 'due_date',
  sortDirection: 'asc',
  items: [],
  cashCategories: [],
  cashSubcategoriesByCategory: Object.create(null),
  payDroppedFile: null,
};

export function patchState(values) {
  Object.assign(state, values);
}

export function resetListState() {
  patchState({ page: 1, total: 0, items: [] });
}
