// Payment Methods — shared configuration

'use strict';

export const PAYMENT_METHODS_API = '/api/paymentMethods';
export const MODAL_ID = 'paymentMethodsModal';
export const MODAL_FOCUS_SELECTOR = '#cpm_name';
export const TABLE_COLUMNS = 18;

export const GAP_FIELDS = Object.freeze([
  'gap_one', 'gap_two', 'gap_three', 'gap_four', 'gap_five',
  'gap_six', 'gap_seven', 'gap_eight', 'gap_nine', 'gap_ten',
]);

export const SELECTORS = Object.freeze({
  tableBody: '#bodyTableList',
  searchForm: '#formPagamento',
  filter: '#filtro',
  typeFilter: '#filtroTipo',
  installmentsFilter: '#filtroParcelas',
  statusFilter: '#filtroStatus',
  tpagFilter: '#filtroTpag',
  clearFiltersButton: '#btnLimparFiltros',
  newButton: '#btnNovo',
  previousButton: '#btnPrevious',
  nextButton: '#btnNext',
  pageInfo: '#pageInfo',
  pageSize: '#pageSize',
  tableInfo: '#apTableInfo',
  form: '#cpmForm',
});
