// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: productsFiscalBatch.init.js                                  ║
// ║ MODULE: Products Fiscal Batch — Initialization                     ║
// ║ PRODNEX ERP                                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  applyBatchLink,
  loadFiscalProfiles,
  loadProducts,
  pickClassification,
} from './productsFiscalBatch.actions.js';
import {
  resetPage,
  syncFiltersFromDom,
} from './productsFiscalBatch.filters.js';
import { toggleAllVisibleProducts } from './productsFiscalBatch.products.js';
import { dom, state } from './productsFiscalBatch.state.js';
import { debounce } from './productsFiscalBatch.utils.js';

function searchProducts() {
  syncFiltersFromDom();
  resetPage();
  return loadProducts();
}

function bindEvents() {
  const debouncedSearch = debounce(searchProducts, 500);

  dom.searchButton?.addEventListener('click', searchProducts);

  dom.searchInput?.addEventListener('keyup', (event) => {
    if (event.key === 'Enter') {
      searchProducts();
      return;
    }

    if (!dom.searchInput.value || dom.searchInput.value.trim().length >= 3) {
      debouncedSearch();
    }
  });

  dom.linkedFilter?.addEventListener('change', searchProducts);

  dom.selectAll?.addEventListener('change', (event) => {
    toggleAllVisibleProducts(event.currentTarget.checked);
  });

  dom.previousButton?.addEventListener('click', () => {
    if (state.page <= 1 || state.loading) return;
    state.page -= 1;
    loadProducts();
  });

  dom.nextButton?.addEventListener('click', () => {
    if (state.page >= state.totalPages || state.loading) return;
    state.page += 1;
    loadProducts();
  });

  dom.pageSize?.addEventListener('change', () => {
    state.pageSize = Number(dom.pageSize.value) || 50;
    state.page = 1;
    loadProducts();
  });

  dom.pickClassificationButton?.addEventListener(
    'click',
    pickClassification
  );

  dom.applyButton?.addEventListener('click', applyBatchLink);
}

export async function bootstrapProductsFiscalBatch() {
  state.pageSize = Number(dom.pageSize?.value) || state.pageSize;
  syncFiltersFromDom();
  bindEvents();

  await loadFiscalProfiles();
  await loadProducts();
}

document.addEventListener(
  'DOMContentLoaded',
  bootstrapProductsFiscalBatch,
  { once: true }
);
