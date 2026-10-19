'use strict';

export const SALES_REPORT_ENDPOINT = '/api/reports/sales';
export const SALES_REPORT_PDF_ENDPOINT = '/api/reports/sales/pdf';
export const COST_MODE_KEY = 'salesReport.costMode';

export const COST_MODES = Object.freeze({
  CURRENT: 'current',
  SALE_DAY: 'saleDay',
});

export const YEAR_SELECT_OPTIONS = Object.freeze({
  pastYears: 12,
  futureYears: 1,
  defaultToCurrentYear: false,
});
