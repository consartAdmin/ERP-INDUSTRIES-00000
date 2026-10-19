// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeReceipts.config.js — Configuração do Canhoto Digital (mobile)    ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export const API_NFE_RECEIPTS = '/api/nfe-receipts';

// Identificação do canhoto: por número da NF-e ou pela chave de 44 dígitos.
export const RECEIPT_PATH = (identifier) =>
  identifier.type === 'key'
    ? `${API_NFE_RECEIPTS}/key/${encodeURIComponent(identifier.value)}`
    : `${API_NFE_RECEIPTS}/number/${encodeURIComponent(identifier.value)}`;

export const ACCESS_KEY_LENGTH = 44;

export const STATUS_LABELS = Object.freeze({
  PENDING: 'Pendente',
  SIGNED: 'Assinado',
  REFUSED: 'Recusado',
  CANCELLED: 'Cancelado'
});

// Traço da assinatura (em px CSS).
export const SIGNATURE_STYLE = Object.freeze({
  lineWidth: 2.4,
  color: '#111111'
});

// Mínimo de pontos desenhados para considerar que há assinatura.
export const SIGNATURE_MIN_POINTS = 8;

// Escala máxima do PNG enviado (limita o tamanho em telas com DPR 3).
export const SIGNATURE_EXPORT_MAX_SCALE = 2;

export const REFUSE_MODAL_ID = 'nfeReceiptsRefuseModal';

export const SELECTORS = Object.freeze({
  searchBox: '#searchBox',
  nfeNumberInput: '#nfeNumberInput',
  btnSearchNfe: '#btnSearchNfe',

  loadingBox: '#loadingBox',
  errorBox: '#errorBox',
  receiptContent: '#receiptContent',
  successBox: '#successBox',
  closedBox: '#closedBox',

  nfeNumero: '#nfeNumero',
  nfeSerie: '#nfeSerie',
  nfeValor: '#nfeValor',
  receiptStatus: '#receiptStatus',

  form: '#receiptForm',
  receiverName: '#receiverName',
  receiverDocument: '#receiverDocument',
  receiverPhone: '#receiverPhone',
  notes: '#notes',
  confirmCheck: '#confirmCheck',

  signatureWrap: '#signatureWrap',
  signatureCanvas: '#signatureCanvas',
  signatureHint: '#signatureHint',
  btnClearSignature: '#btnClearSignature',

  btnSubmit: '#btnSubmit',
  btnRefuse: '#btnRefuse',
  btnNewSearch: '#btnNewSearch'
});

export function getPageElements() {
  const elements = {};
  for (const [key, selector] of Object.entries(SELECTORS)) {
    elements[key] = document.querySelector(selector);
  }
  return elements;
}
