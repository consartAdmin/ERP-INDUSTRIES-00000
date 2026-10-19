// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: productsFiscalBatch.state.js                                 ║
// ║ MODULE: Products Fiscal Batch — State                              ║
// ║ PRODNEX ERP                                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { DEFAULT_PAGE_SIZE } from './productsFiscalBatch.config.js';

export const state = {
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  total: 0,
  totalPages: 1,
  search: '',
  linkedFilter: '',
  loading: false,
  products: [],
  selected: new Set(),
  classification: null,
  fiscalProfileId: '',
};

const $ = (selector, root = document) => root.querySelector(selector);

export const dom = {
  searchInput: $('#pfb-search-input'),
  searchButton: $('#pfb-search-btn'),
  linkedFilter: $('#pfb-linked-filter'),
  productsBody: $('#pfb-products-body'),
  selectAll: $('#pfb-select-all'),
  previousButton: $('#btnPrevious'),
  nextButton: $('#btnNext'),
  pageInfo: $('#pageInfo'),
  pageSize: $('#pageSize'),
  tableInfo: $('#apTableInfo'),
  summarySelected: $('#pfb-summary-selected'),
  pickClassificationButton: $('#pfb-pick-classification'),
  classificationDisplay: $('#pfb-classification-display'),
  summaryClassification: $('#pfb-summary-classification'),
  fiscalProfileSelect: $('#pfb-fiscal-profile'),
  summaryProfile: $('#pfb-summary-profile'),
  applyButton: $('#pfb-apply-batch'),
};
