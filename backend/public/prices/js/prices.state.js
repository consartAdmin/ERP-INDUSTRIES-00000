import { DEFAULT_FILTERS } from './prices.config.js';

export const state = {
  loading: false,
  total: 0,
  totalPages: 1,
  rows: [],
  editingId: null,
  ...DEFAULT_FILTERS,
};

export const dom = {};

