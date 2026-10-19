// ╔══════════════════════════════════════════════════════════════════╗
// ║ supplierReturns.sql.js — fragmentos SQL de status NF-e           ║
// ║ toNfeStatusCode, nfeStatusIdSql, SELECT/JOIN do nfeStatusMap     ║
// ╚══════════════════════════════════════════════════════════════════╝

import { TABLE_NFE_STATUS_MAP, RETURN_STATUS_TO_NFE_CODE } from './supplierReturns.constants.js';
import { normalizeStatus } from './supplierReturns.utils.js';

export function toNfeStatusCode(returnStatus) {
    return RETURN_STATUS_TO_NFE_CODE[normalizeStatus(returnStatus)] || 'PENDENTE';
}

/** Subquery que resolve nfe_status_id a partir do code no parâmetro $N. */
export function nfeStatusIdSql(paramIndex) {
    return `(SELECT nfe_status_id FROM ${TABLE_NFE_STATUS_MAP} WHERE code = $${paramIndex} AND is_active = TRUE LIMIT 1)`;
}

export const NFE_STATUS_SELECT_SQL = `
    nsm.code AS nfe_status_code,
    nsm.name AS nfe_status_name,
    nsm.is_final AS nfe_status_is_final,
    nsm.is_authorized AS nfe_status_is_authorized`;

export const NFE_STATUS_JOIN_SQL = `LEFT JOIN ${TABLE_NFE_STATUS_MAP} nsm ON nsm.nfe_status_id = sr.nfe_status_id`;
