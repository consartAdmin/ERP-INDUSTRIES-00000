// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: productsFiscalBatch.products.js                              ║
// ║ MODULE: Products Fiscal Batch — Product Selection                  ║
// ║ PRODNEX ERP                                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { dom, state } from './productsFiscalBatch.state.js';
import { queryAll } from './productsFiscalBatch.utils.js';

export function updateSelectionSummary() {
  if (dom.summarySelected) {
    dom.summarySelected.textContent = String(state.selected.size);
  }
}

export function toggleProductSelection(productCode, checked) {
  if (!productCode) return;

  if (checked) {
    state.selected.add(String(productCode));
  } else {
    state.selected.delete(String(productCode));
  }

  updateSelectionSummary();
  syncSelectAllState();
}

export function toggleAllVisibleProducts(checked) {
  queryAll(
    '#pfb-products-body input[type="checkbox"][data-product-id]'
  ).forEach((checkbox) => {
    const productId = checkbox.dataset.productId;
    checkbox.checked = checked;

    if (checked) {
      state.selected.add(String(productId));
    } else {
      state.selected.delete(String(productId));
    }
  });

  updateSelectionSummary();
  syncSelectAllState();
}

export function syncSelectAllState() {
  if (!dom.selectAll) return;

  const checkboxes = queryAll(
    '#pfb-products-body input[type="checkbox"][data-product-id]'
  );

  const selectedOnPage = checkboxes.filter((checkbox) =>
    state.selected.has(String(checkbox.dataset.productId))
  ).length;

  dom.selectAll.checked =
    checkboxes.length > 0 && selectedOnPage === checkboxes.length;

  dom.selectAll.indeterminate =
    selectedOnPage > 0 && selectedOnPage < checkboxes.length;
}

export function clearSelection() {
  state.selected.clear();
  updateSelectionSummary();
  syncSelectAllState();
}
