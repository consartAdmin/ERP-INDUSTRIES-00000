// ╔══════════════════════════════════════════════════════════════════╗
// ║ supplierReturnsSync.repository.js — sincroniza status PlugNotas  ║
// ║ syncPlugNotas — consulta NF-e e atualiza status                  ║
// ╚══════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import tecnoSpeedNfeApi from '../nfe/nfe.index.js';
import { normalizeNfeStatusCode } from '../../repositories/invoicesIssued/_shared.js';
import { TABLE_HEAD, NFE_CODE_TO_RETURN_STATUS } from './supplierReturns.constants.js';
import { toNumber } from './supplierReturns.utils.js';
import { nfeStatusIdSql } from './supplierReturns.sql.js';
import { ensureTables } from './supplierReturnsSchema.repository.js';
import { getById } from './supplierReturnsGetById.repository.js';

export async function syncPlugNotas(returnId) {
    await ensureTables();

    const id = toNumber(returnId, 0);
    if (!id) throw new Error('ID inválido.');

    const data = await getById(id);
    if (!data) throw new Error('Devolução não encontrada.');
    if (!data.plugnotas_id) throw new Error('NF-e ainda não possui ID PlugNotas.');

    const result = await tecnoSpeedNfeApi.consultarNFe(data.plugnotas_id);

    console.log('[SUPPLIER RETURN][SYNC PLUGNOTAS]', JSON.stringify(result, null, 2));

    // PlugNotas responde { ok, data: [ { status: 'CONCLUIDO', numero, cStat, ... } ], status: 200 }
    const response = result?.data || result || {};
    const doc = Array.isArray(response)
        ? response[0] || {}
        : response.documentos?.[0] || response.documents?.[0] || response;

    const nfeNumber =
        doc?.numero ||
        doc?.numeroNfe ||
        doc?.nNF ||
        null;

    const statusPlug =
        doc?.situacao ||
        (typeof doc?.status === 'string' ? doc.status : '') ||
        (Number(doc?.cStat) === 100 ? 'AUTORIZADO' : '') ||
        'PROCESSING';

    // Situação PlugNotas → code do nfeStatusMap (AUTORIZADO, REJEITADO, CANCELADO...)
    const plugCode = normalizeNfeStatusCode(statusPlug);
    const nfeStatusCode = NFE_CODE_TO_RETURN_STATUS[plugCode] ? plugCode : 'PROCESSANDO';
    const returnStatus = NFE_CODE_TO_RETURN_STATUS[nfeStatusCode];
    const authorized = nfeStatusCode === 'AUTORIZADO';

    await pool.query(
        `
        UPDATE ${TABLE_HEAD}
           SET status = $1,
               nfe_status_id = ${nfeStatusIdSql(7)},
               plugnotas_status = $2,
               plugnotas_response = $3::jsonb,
               nfe_number = COALESCE($4, nfe_number),
               authorized_at = CASE WHEN $5 THEN COALESCE(authorized_at, now()) ELSE authorized_at END,
               updated_at = now()
         WHERE return_id = $6
        `,
        [
            returnStatus,
            String(statusPlug || 'PROCESSING'),
            JSON.stringify(result || {}),
            nfeNumber ? Number(nfeNumber) : null,
            authorized,
            id,
            nfeStatusCode,
        ],
    );

    return getById(id);
}
