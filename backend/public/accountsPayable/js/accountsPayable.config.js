'use strict';

export const API = Object.freeze({
  base: '/api/accounts-payable',
  exportPdf: '/api/accounts-payable/export/pdf',
  exportExcel: '/api/accounts-payable/export/excel',
  pay: (id) => `/api/accounts-payable/${id}/pay`,
  attachments: (id) => `/api/accounts-payable/${id}/anexos`,
  cash: '/api/caixa/movimentacoes',
  cashCategories: '/api/caixa/categorias',
  cashSubcategories: '/api/caixa/subcategorias',
  bankAccounts: '/api/bank-accounts?active=true',
  documentTypes: '/api/cash-document-types?activeOnly=true',
  uploadSign: '/api/upload/accounts-payable/anexo/sign',
  uploadConfirm: '/api/upload/accounts-payable/anexo/confirm',
});

export const PAGE_SIZE_OPTIONS = Object.freeze([10, 20, 30, 50, 100]);
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024;
export const ALLOWED_ATTACHMENT_EXTENSIONS =
  new Set(['pdf', 'xml', 'png', 'jpg', 'jpeg', 'webp']);
