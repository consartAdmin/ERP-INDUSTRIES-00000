// ╔══════════════════════════════════════════════════════════════════╗
// ║ supplierReturns.constants.js — tabelas e mapas de status         ║
// ║ supplierReturnNfe / Items / ImportedItems / nfeStatusMap         ║
// ╚══════════════════════════════════════════════════════════════════╝

export const TABLE_HEAD = 'public."supplierReturnNfe"';
export const TABLE_ITEMS = 'public."supplierReturnNfeItems"';
export const TABLE_IMPORTED = 'public."supplierReturnNfeImportedItems"';
export const TABLE_NFE_STATUS_MAP = 'public."nfeStatusMap"';

/**
 * Status interno da devolução → code em public."nfeStatusMap".
 * DRAFT/READY ainda não foram transmitidas, então ficam como PENDENTE.
 */
export const RETURN_STATUS_TO_NFE_CODE = Object.freeze({
    DRAFT: 'PENDENTE',
    READY: 'PENDENTE',
    PROCESSING: 'PROCESSANDO',
    TRANSMITTED: 'PROCESSANDO',
    AUTHORIZED: 'AUTORIZADO',
    REJECTED: 'REJEITADO',
    CANCELLED: 'CANCELADO',
});

/** code do nfeStatusMap → status interno da devolução (usado no sync, após emissão) */
export const NFE_CODE_TO_RETURN_STATUS = Object.freeze({
    PENDENTE: 'PROCESSING',
    PROCESSANDO: 'PROCESSING',
    AUTORIZADO: 'AUTHORIZED',
    REJEITADO: 'REJECTED',
    DENEGADO: 'REJECTED',
    CANCELADO: 'CANCELLED',
    INUTILIZADO: 'CANCELLED',
    ERRO: 'REJECTED',
});
