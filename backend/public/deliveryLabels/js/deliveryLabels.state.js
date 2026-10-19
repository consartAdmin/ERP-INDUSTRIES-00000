// ╔══════════════════════════════════════════════════════════════╗
// ║ deliveryLabels.state.js — Estado da tela                    ║
// ║ PRODNEX ERP | Frontend ESM                                  ║
// ╚══════════════════════════════════════════════════════════════╝

import { DEFAULT_ROWS_PER_PAGE } from './deliveryLabels.config.js';

export const deliveryLabelsState = {
  // { source: 'order' | 'budget' | 'invoice', id, label }
  selectedSource: null,
  labels: [],
  page: 1,
  rowsPerPage: DEFAULT_ROWS_PER_PAGE,
  total: 0,
  totalPages: 1,
  loading: false
};

export function setSelectedSource(selection) {
  deliveryLabelsState.selectedSource = selection || null;
}

export function setLabelsResult({ items, page, rowsPerPage, total }) {
  deliveryLabelsState.labels = Array.isArray(items) ? items : [];
  deliveryLabelsState.page = Math.max(1, Number(page) || 1);
  deliveryLabelsState.rowsPerPage = Math.max(1, Number(rowsPerPage) || DEFAULT_ROWS_PER_PAGE);
  deliveryLabelsState.total = Math.max(0, Number(total) || 0);
  deliveryLabelsState.totalPages = Math.max(
    1,
    Math.ceil(deliveryLabelsState.total / deliveryLabelsState.rowsPerPage)
  );
}
