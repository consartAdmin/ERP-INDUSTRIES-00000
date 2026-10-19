'use strict';

export const state = {
  loading: false,
  alertHandler: null,
  activeTab: 'day',
  page: 1,
  pageSize: 50,
  reportData: {
    byDay: [],
    byCustomer: [],
    byProduct: [],
  },
};

export const dom = {};

export function cacheDom() {
  Object.assign(dom, {
    root: document.querySelector('.page-sales-report') || document.querySelector('.consart-container'),
    btnApply: document.querySelector('#btn-apply-filters'),
    btnReset: document.querySelector('#btn-reset-filters'),
    btnExportCsv: document.querySelector('#btn-export-csv'),
    btnPdfFull: document.querySelector('#btn-pdf-full'),
    btnPdfProducts: document.querySelector('#btn-pdf-products'),
    btnPdfOrders: document.querySelector('#btn-pdf-orders'),
    btnCostMode: document.querySelector('#btn-cost-mode'),
    btnBack: document.querySelector('#btn-back'),
    dateRange: document.querySelector('#filter-date-range'),
    month: document.querySelector('#filter-month'),
    year: document.querySelector('#filter-year'),
    seller: document.querySelector('#filter-seller-id'),
    customer: document.querySelector('#filter-customer-id'),
    product: document.querySelector('#filter-product-id'),
    summaryOrders: document.querySelector('#summary-orders'),
    summaryItems: document.querySelector('#summary-items'),
    summaryTotal: document.querySelector('#summary-total'),
    summaryTicket: document.querySelector('#summary-ticket'),
    summaryGrossProfit: document.querySelector('#summary-gross-profit'),
    tbodyDay: document.querySelector('#tbody-by-day'),
    tbodyCustomer: document.querySelector('#tbody-by-customer'),
    tbodyProduct: document.querySelector('#tbody-by-product'),
    averageCostHeader: document.querySelector('#th-avg-cost'),
    tableInfo: document.querySelector('#apTableInfo'),
    pageInfo: document.querySelector('#apPageInfo'),
    btnPreviousPage: document.querySelector('#btnPreviousPage'),
    btnNextPage: document.querySelector('#btnNextPage'),
    rowsPerPage: document.querySelector('#apRowsPerPage'),
  });

  const configuredPageSize = Number(dom.rowsPerPage?.value);
  if (Number.isInteger(configuredPageSize) && configuredPageSize > 0) {
    state.pageSize = configuredPageSize;
  }
}
