// ╔════════════════════════════════════════════════════════════════════╗
// ║ nfeStatusMapResolve.repository.js — resolveStatusId / requireByCode║
// ║ Tabela: public."nfeStatusMap"                                      ║
// ╚════════════════════════════════════════════════════════════════════╝

import { getByCode } from './nfeStatusMapQuery.repository.js';


/* =========================================================================
 * Resolve ID by code
 *
 * Uso interno:
 *
 * const status = await resolveStatusId('AUTORIZADO');
 *
 * if (status.ok) {
 *     const nfeStatusId = status.data.nfe_status_id;
 * }
 * ========================================================================= */

export async function resolveStatusId(code) {
    return getByCode(code);
}

export async function requireByCode(code) {
    const result = await getByCode(code);

    if (!result.ok || !result.data) {
        const error = new Error(
            result.error ||
            `Status NF-e "${String(code || '').trim()}" não encontrado.`
        );

        error.status = result.status || 500;
        error.code = 'NFE_STATUS_NOT_FOUND';

        throw error;
    }

    return result.data;
}
