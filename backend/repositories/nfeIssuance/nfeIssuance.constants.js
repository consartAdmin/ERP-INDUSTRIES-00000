// ╔═══════════════════════════════════════════════════════════╗
// ║ nfeIssuance.constants.js — constantes da emissão de NF-e  ║
// ║ tabelas de tentativas, aliases de status, limites ICMS-ST ║
// ╚═══════════════════════════════════════════════════════════╝

// ============================================================================
// ICMS-ST RETIDO ANTERIORMENTE (CST 60)
//
// A origem do ICMS-ST é localizada em inboundInvoiceItems conforme o modo:
//   STOCK_SIMPLE   -> product_code
//   STOCK_WITH_LOT -> lot_id + product_code
//
// Fontes, nesta ordem de prioridade:
//   1) colunas icms_st_base / icms_st_rate / icms_st_value (e fcp_st_*);
//   2) raw_tax_payload normalizado (chaves planas, como icms_st_base);
//   3) raw_tax_payload no formato XML/xml2js (ICMS10, ICMS60, ICMSSN500 etc.).
//
// Os valores da entrada referem-se à quantidade total daquela entrada, por
// isso são convertidos para valor por unidade base e aplicados à quantidade
// vendida no orçamento.
// ============================================================================

export const ICMS_ST_RETAINED_SOURCE_CSTS = new Set(['60', '500']);

export const ICMS_ST_CANDIDATE_LIMIT = 25;

// Itens enriquecidos em paralelo, com folga em relação ao PGPOOL_MAX (10).
export const ITEM_ENRICHMENT_CONCURRENCY = 4;

export const ATTEMPTS_TABLE = 'public."budgetsNfeAttempts"';

export const ATTEMPT_ITEMS_TABLE = 'public."budgetsNfeAttemptItems"';

export const STATUS_TABLE = 'public."nfeStatusMap"';

export const STATUS_ALIASES = Object.freeze({
  ENVIANDO: ['ENVIANDO', 'SENDING', 'PROCESSANDO', 'PROCESSING', 'PENDENTE', 'PENDING'],
  PROCESSANDO: ['PROCESSANDO', 'PROCESSING', 'ENVIANDO', 'SENDING', 'PENDENTE', 'PENDING'],
  AUTORIZADA: ['AUTORIZADA', 'AUTORIZADO', 'AUTHORIZED'],
  REJEITADA: ['REJEITADA', 'REJEITADO', 'REJECTED'],
  DENEGADA: ['DENEGADA', 'DENEGADO', 'DENIED'],
  CANCELADA: ['CANCELADA', 'CANCELADO', 'CANCELLED', 'CANCELED'],
  ERRO: ['ERRO', 'ERROR'],
});

// Status finais que permitem uma nova tentativa de emissão para o orçamento.
export const RETRYABLE_ATTEMPT_STATUS_CODES = new Set([
  'ERRO', 'ERROR',
  'REJEITADA', 'REJEITADO', 'REJECTED',
  'DENEGADA', 'DENEGADO', 'DENIED',
]);

// Subconjunto em que o número de NF-e reservado pode ser reaproveitado: a NF-e
// nunca passou a existir na SEFAZ. DENEGADA fica de fora de propósito — o
// número é consumido e precisa de inutilização de numeração.
export const REUSABLE_NFE_NUMBER_STATUS_CODES = new Set([
  'ERRO', 'ERROR',
  'REJEITADA', 'REJEITADO', 'REJECTED',
]);
