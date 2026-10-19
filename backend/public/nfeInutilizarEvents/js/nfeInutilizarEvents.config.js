// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeInutilizarEvents.config.js — Configuração do módulo              ║
// ║ MODULE: NF-e Inutilização de Numeração                              ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

/* =======================================================================
 * API
 * ======================================================================= */
export const API_BASE = '/api/nfes/inutilizar';

/* =======================================================================
 * Defaults
 * ======================================================================= */
export const DEFAULTS = Object.freeze({
  MODEL: '55',
  LIST_LIMIT: 100,
  LIST_OFFSET: 0,
});

/* =======================================================================
 * Regras do formulário
 * ======================================================================= */
export const RULES = Object.freeze({
  CNPJ_LENGTH: 14,
  MIN_YEAR: 2000,
  MIN_JUSTIFICATION: 15,
  MAX_JUSTIFICATION: 255,
});

/* =======================================================================
 * Status padrão
 * ======================================================================= */
export const STATUS = Object.freeze({
  UNKNOWN: 'UNKNOWN',
  PENDING: 'PENDING',
  SENT: 'SENT',
  PROCESSING: 'PROCESSING',
  ERROR: 'ERROR',
  REJECTED: 'REJECTED',
  AUTHORIZED: 'AUTHORIZED',
  DONE: 'DONE',
  SUCCESS: 'SUCCESS',
  CONCLUIDO: 'CONCLUIDO',
  INUTILIZADA: 'INUTILIZADA',
});
