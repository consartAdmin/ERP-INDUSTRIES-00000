// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ordersNfeAttempts.constants.js — Constantes                          ║
// ║ Conjuntos de colunas do catálogo e status de NF-e                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  ORDER_NFE_ATTEMPT_INSERT_COLUMNS,
  ORDER_NFE_ATTEMPT_UPDATE_COLUMNS,
  ORDER_NFE_ATTEMPT_JSON_COLUMNS,
  ORDER_NFE_ATTEMPT_ITEM_INSERT_COLUMNS,
  ORDER_NFE_ATTEMPT_ITEM_JSON_COLUMNS,
} from './ordersNfeAttempts.catalog.js';

export const ATTEMPT_INSERT = new Set(ORDER_NFE_ATTEMPT_INSERT_COLUMNS);
export const ATTEMPT_UPDATE = new Set(ORDER_NFE_ATTEMPT_UPDATE_COLUMNS);
export const ATTEMPT_JSON = new Set(ORDER_NFE_ATTEMPT_JSON_COLUMNS);
export const ITEM_INSERT = new Set(ORDER_NFE_ATTEMPT_ITEM_INSERT_COLUMNS);
export const ITEM_JSON = new Set(ORDER_NFE_ATTEMPT_ITEM_JSON_COLUMNS);
export const NFE_STATUS_ID = Object.freeze({
    PENDING: 1,
    PROCESSING: 2,
    AUTHORIZED: 3,
    REJECTED: 4,
    DENIED: 5,
    CANCELLED: 6,
    VOIDED: 7,
    ERROR: 8,
});
