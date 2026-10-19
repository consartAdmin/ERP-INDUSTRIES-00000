// ╔══════════════════════════════════════════════════════════════════════╗
// ║ invoicesIssued.config.js — Configuração do módulo invoicesIssued                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

export const API_BASE = '/api/invoices-issued';

export const DEFAULT_LIMIT = 20;

export const NFE_STATUS_API_BASE = '/api/nfe-status-map';

export const NFE_STATUS_CODES = Object.freeze({
  PENDENTE: 'PENDENTE',
  PROCESSANDO: 'PROCESSANDO',
  AUTORIZADO: 'AUTORIZADO',
  REJEITADO: 'REJEITADO',
  DENEGADO: 'DENEGADO',
  CANCELADO: 'CANCELADO',
  INUTILIZADO: 'INUTILIZADO',
  ERRO: 'ERRO',
});

export const INVOICES_SORT_COLUMNS = Object.freeze([
  'id',
  'order_id',
  'nfe_number',
  'customer_name',
  'customer_tax_id',
  'nfe_status',
  'issued_date',
  'total_amount',
]);
