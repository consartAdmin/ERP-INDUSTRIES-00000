import { $, $$ } from './pdvSalesReport.utils.js';

export const elements = {
  btnApplyFilters: document.getElementById('btn-apply-filters'),
  btnResetFilters: document.getElementById('btn-reset-filters'),

  btnPdfFull: document.getElementById('btn-pdf-full'),
  btnPdfProducts: document.getElementById('btn-pdf-products'),
  btnPdfOrders: document.getElementById('btn-pdf-orders'),

  btnExportCsv: document.getElementById('btn-export-csv'),
  btnDownloadXmls: document.getElementById('btn-download-xmls'),

  filterDateStart: document.getElementById('filter-date-start'),
  filterDateEnd: document.getElementById('filter-date-end'),
  filterCustomerId: document.getElementById('filter-customer-id'),
  filterProductId: document.getElementById('filter-product-id'),
  filterMonth: document.getElementById('filter-month'),
  filterYear: document.getElementById('filter-year'),

  tabButtons: document.querySelectorAll('[role="tab"]'),
  tabPanels: document.querySelectorAll('.sr-tab-panel'),

  tbodyByDay: document.getElementById('tbody-by-day'),
  tbodyByCustomer: document.getElementById('tbody-by-customer'),
  tbodyByProduct: document.getElementById('tbody-by-product')
};

export function buildQueryParams() {
  const params = new URLSearchParams();
  const fields = [
    ['startDate', elements.filterDateStart],
    ['endDate', elements.filterDateEnd],
    ['month', elements.filterMonth],
    ['year', elements.filterYear],
    ['customerId', elements.filterCustomerId],
    ['productId', elements.filterProductId]
  ];

  fields.forEach(([key, input]) => {
    if (input?.value) params.set(key, input.value);
  });
  return params;
}

export function clearFilters() {
  [
    elements.filterDateStart,
    elements.filterDateEnd,
    elements.filterCustomerId,
    elements.filterProductId,
    elements.filterMonth,
    elements.filterYear
  ].forEach((input) => { if (input) input.value = ''; });
}
