/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ FILE: nfeCce.form.js                                               ║
   ║ MODULE: NF-e | Carta de Correção Eletrônica (CC-e)                 ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

'use strict';

import { els } from './nfeCce.state.js';
import { normalizeText } from './nfeCce.utils.js';

export function readEmissaoForm() {
    return {
        idOuChave: normalizeText(els.idOuChave?.value),
        orderId: normalizeText(els.orderId?.value),
        nfeKey: normalizeText(els.nfeKey?.value),
        nfePlugnotasId: normalizeText(els.nfePlugnotasId?.value),
        correcao: normalizeText(els.correcao?.value),
        createdBy: normalizeText(els.createdBy?.value),
    };
}

export function readConsultaStatusForm() {
    return {
        identificador: normalizeText(els.consultaIdentificador?.value),
        listaCce: Boolean(els.consultaListaCce?.checked),
    };
}

export function readDocumentoForm() {
    return {
        identificador: normalizeText(els.documentoIdentificador?.value),
    };
}

export function readHistoricoFilters() {
    return {
        nfeNumber: normalizeText(els.filtroNfeNumber?.value),
        nfeKey: normalizeText(els.filtroNfeKey?.value),
        idOuChave: normalizeText(els.filtroIdOuChave?.value),
    };
}

export function updateHistoricoFilters(payload) {
    if (els.filtroOrderId && payload.orderId) {
        els.filtroOrderId.value = payload.orderId;
    }
    if (els.filtroNfeKey && payload.nfeKey) {
        els.filtroNfeKey.value = payload.nfeKey;
    }
    if (els.filtroIdOuChave && payload.idOuChave) {
        els.filtroIdOuChave.value = payload.idOuChave;
    }
}

export function clearFormFields() {
    [
        els.invoiceId,
        els.nfeNumber,
        els.idOuChave,
        els.orderId,
        els.nfeKey,
        els.nfePlugnotasId,
        els.createdBy,
        els.correcao,
        els.consultaIdentificador,
        els.documentoIdentificador,
        els.filtroNfeNumber,
        els.filtroNfeKey,
        els.filtroIdOuChave,
    ].forEach((input) => {
        if (input) input.value = '';
    });

    if (els.consultaListaCce) {
        els.consultaListaCce.checked = false;
    }
}
