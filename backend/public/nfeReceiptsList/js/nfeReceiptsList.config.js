// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeReceiptsList.config.js — Configuração do módulo Canhotos Digitais║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export const API_NFE_RECEIPTS = '/api/nfe-receipts';
export const API_SIGNATURE_PNG = (accessKey) =>
  `${API_NFE_RECEIPTS}/key/${encodeURIComponent(accessKey)}/signature.png`;

export const DEFAULT_PAGE_SIZE = 50;

// Limite máximo aceito pelo backend por página (usado na exportação).
export const MAX_API_PAGE_SIZE = 100;

export const TABLE_COLSPAN = 11;

export const MODAL_ID = 'nfeReceiptsSignatureModal';

export const STATUS_LABELS = Object.freeze({
  PENDING: 'Pendente',
  SIGNED: 'Assinado',
  REFUSED: 'Recusado',
  CANCELLED: 'Cancelado'
});

export const SELECTORS = Object.freeze({
  searchInput: '#searchInput',
  statusFilter: '#statusFilter',
  dateFrom: '#dateFrom',
  dateTo: '#dateTo',
  btnSearch: '#btnSearch',
  btnReload: '#btnReload',
  btnExcel: '#btnExcel',
  btnPdf: '#btnPdf',
  tableBody: '#tableBody',
  tableInfo: '#tableInfo',
  pageInfo: '#pageInfo',
  btnPrevious: '#btnPrevious',
  btnNext: '#btnNext',
  pageSize: '#pageSize'
});

export function getPageElements() {
  const elements = {};
  for (const [key, selector] of Object.entries(SELECTORS)) {
    elements[key] = document.querySelector(selector);
  }
  return elements;
}
