/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ FILE: nfeCce.validation.js                                         ║
   ║ MODULE: NF-e | Carta de Correção Eletrônica (CC-e)                 ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

'use strict';

export function validateEmissaoForm(payload) {
    if (
        !payload.idOuChave &&
        !payload.orderId &&
        !payload.nfeKey &&
        !payload.nfePlugnotasId
    ) {
        throw new Error('Informe ao menos um identificador da NF-e.');
    }

    if (!payload.correcao) {
        throw new Error('Informe o texto da carta de correção.');
    }

    if (payload.correcao.length < 15) {
        throw new Error('O texto da CC-e deve ter no mínimo 15 caracteres.');
    }

    if (payload.correcao.length > 1000) {
        throw new Error('O texto da CC-e deve ter no máximo 1000 caracteres.');
    }

    return payload;
}

export function validateConsultaStatusForm(payload) {
    if (!payload.identificador) {
        throw new Error('Informe o identificador para consulta de status.');
    }
    return payload;
}

export function validateDocumentoForm(payload) {
    if (!payload.identificador) {
        throw new Error('Informe o identificador para abrir PDF/XML.');
    }
    return payload;
}
