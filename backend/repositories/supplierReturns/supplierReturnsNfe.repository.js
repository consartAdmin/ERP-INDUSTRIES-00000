// ╔══════════════════════════════════════════════════════════════════╗
// ║ supplierReturnsNfe.repository.js — emissão e downloads NF-e      ║
// ║ emitNfe, downloadXml, downloadPdf (TecnoSpeed/PlugNotas)         ║
// ╚══════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import tecnoSpeedNfeApi from '../nfe/nfe.index.js';
import { TABLE_HEAD } from './supplierReturns.constants.js';
import { toNumber } from './supplierReturns.utils.js';
import { toNfeStatusCode, nfeStatusIdSql } from './supplierReturns.sql.js';
import { buildNfeDraft } from './supplierReturnsDraft.repository.js';
import { getById } from './supplierReturnsGetById.repository.js';

export async function emitNfe(returnId) {
    const id = toNumber(returnId, 0);
    if (!id) throw new Error('ID inválido.');

    const draft = await buildNfeDraft(id);
    if (!draft) throw new Error('Devolução não encontrada.');

    const result = await tecnoSpeedNfeApi.emitirNFeSupplierReturn(draft);

    console.log('[SUPPLIER RETURN][TECNOSPEED RESULT]', JSON.stringify(result, null, 2));

    if (!result?.ok) {
        const msg =
            result?.message ||
            result?.error?.message ||
            result?.error ||
            'Falha ao emitir NF-e de devolução.';

        await pool.query(
            `
        UPDATE ${TABLE_HEAD}
           SET status = 'REJECTED',
               nfe_status_id = ${nfeStatusIdSql(4)},
               rejected_reason = $1,
               plugnotas_response = $2::jsonb,
               updated_at = now()
         WHERE return_id = $3
      `,
            [String(msg), JSON.stringify(result || {}), id, toNfeStatusCode('REJECTED')],
        );

        throw new Error(String(msg));
    }

    const data = result.data || {};

    const firstDocument =
        data.documents?.[0] ||
        data.documentos?.[0] ||
        data[0] ||
        data;

    const plugnotasId =
        firstDocument?.id ||
        firstDocument?.idNotaFiscal ||
        firstDocument?.idIntegracao ||
        data.id ||
        null;

    const plugStatus =
        firstDocument?.situacao ||
        firstDocument?.status ||
        data.situacao ||
        data.status ||
        data.message ||
        'PROCESSING';

    const nfeNumber =
        firstDocument?.numero ||
        firstDocument?.numeroNfe ||
        firstDocument?.nNF ||
        firstDocument?.nfeNumero ||
        data.numero ||
        data.numeroNfe ||
        data.nNF ||
        null;

    await pool.query(
        `
  UPDATE ${TABLE_HEAD}
     SET status = $1,
         nfe_status_id = ${nfeStatusIdSql(7)},
         plugnotas_id = $2,
         plugnotas_status = $3,
         plugnotas_response = $4::jsonb,
         nfe_number = $5,
         emitted_at = now(),
         updated_at = now()
   WHERE return_id = $6
`,
        [
            'PROCESSING',
            plugnotasId,
            String(plugStatus || 'PROCESSING'),
            JSON.stringify(result),
            nfeNumber ? Number(nfeNumber) : null,
            id,
            toNfeStatusCode('PROCESSING'),
        ],
    );

    return {
        ...result,
        plugnotas_id: plugnotasId,
        plugnotas_status: plugStatus,
    };
}

export async function downloadXml(returnId) {
    const data = await getById(returnId);
    if (!data) throw new Error('Devolução não encontrada.');
    if (!data.plugnotas_id) throw new Error('NF-e ainda não possui ID PlugNotas.');

    return tecnoSpeedNfeApi.obterXml(data.plugnotas_id);
}

export async function downloadPdf(returnId) {
    const data = await getById(returnId);
    if (!data) throw new Error('Devolução não encontrada.');
    if (!data.plugnotas_id) throw new Error('NF-e ainda não possui ID PlugNotas.');

    return tecnoSpeedNfeApi.obterPdf(data.plugnotas_id);
}
