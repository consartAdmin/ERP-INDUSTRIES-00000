/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ FILE: nfeCce.actions.js                                            ║
   ║ MODULE: NF-e | Carta de Correção Eletrônica (CC-e)                 ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

'use strict';

import { consultarStatus, emitirCce } from './nfeCce.api.js';
import { ROUTES } from './nfeCce.config.js';
import {
    clearFormFields,
    readConsultaStatusForm,
    readDocumentoForm,
    readEmissaoForm,
    updateHistoricoFilters,
} from './nfeCce.form.js';
import { onBuscarHistorico } from './nfeCce.history.js';
import { clearSelectedInvoice } from './nfeCce.invoices.js';
import {
    clearDetalhesEvento,
    clearResultadoEmissao,
    renderEventos,
    renderStatus,
    updateCorrecaoCounter,
} from './nfeCce.render.js';
import { els, state } from './nfeCce.state.js';
import {
    extractEventStatus,
    normalizeText,
    openUrl,
    parseErrorMessage,
    setFeedback,
    setJsonPreview,
} from './nfeCce.utils.js';
import {
    validateConsultaStatusForm,
    validateDocumentoForm,
    validateEmissaoForm,
} from './nfeCce.validation.js';

export function onValidarCampos() {
    try {
        validateEmissaoForm(readEmissaoForm());
        setFeedback('Campos validados com sucesso.', 'success');
    } catch (error) {
        setFeedback(parseErrorMessage(error), 'error');
    }
}

export async function onEmitirCce() {
    try {
        const payload = validateEmissaoForm(readEmissaoForm());
        setFeedback('Emitindo CC-e...', 'info');
        clearResultadoEmissao();

        const data = await emitirCce({
            idOuChave: payload.idOuChave || undefined,
            orderId: payload.orderId || undefined,
            nfeKey: payload.nfeKey || undefined,
            nfePlugnotasId: payload.nfePlugnotasId || undefined,
            correcao: payload.correcao,
            createdBy: payload.createdBy || undefined,
        });

        const statusPayload =
            data?.data?.status || data?.data?.envio || data?.data || {};
        const ultimoIdentificador =
            payload.idOuChave ||
            payload.nfePlugnotasId ||
            payload.nfeKey ||
            payload.orderId ||
            '';

        state.ultimoIdentificador = ultimoIdentificador;
        state.ultimoStatusPayload = statusPayload;
        renderStatus(extractEventStatus(statusPayload));
        setJsonPreview(els.jsonRetorno, data);

        if (els.btnAbrirPdfUltimo) {
            els.btnAbrirPdfUltimo.disabled = !ultimoIdentificador;
        }
        if (els.btnAbrirXmlUltimo) {
            els.btnAbrirXmlUltimo.disabled = !ultimoIdentificador;
        }

        updateHistoricoFilters(payload);
        setFeedback('CC-e emitida com sucesso.', 'success');
        await onBuscarHistorico();
    } catch (error) {
        clearResultadoEmissao();
        setFeedback(parseErrorMessage(error, 'Falha ao emitir CC-e.'), 'error');
    }
}

export async function onConsultarStatus() {
    try {
        const payload = validateConsultaStatusForm(readConsultaStatusForm());
        setFeedback('Consultando status da CC-e...', 'info');

        const data = await consultarStatus(
            payload.identificador,
            payload.listaCce
        );

        setJsonPreview(els.jsonConsultaStatus, data);
        renderStatus(extractEventStatus(data?.data || data));

        state.ultimoIdentificador = payload.identificador;
        state.ultimoStatusPayload = data?.data || data;
        if (els.btnAbrirPdfUltimo) els.btnAbrirPdfUltimo.disabled = false;
        if (els.btnAbrirXmlUltimo) els.btnAbrirXmlUltimo.disabled = false;
        setFeedback('Status consultado com sucesso.', 'success');
        await onBuscarHistorico();
    } catch (error) {
        setJsonPreview(els.jsonConsultaStatus, {});
        setFeedback(
            parseErrorMessage(error, 'Falha ao consultar status.'),
            'error'
        );
    }
}

function getLastIdentifier() {
    return (
        state.ultimoIdentificador ||
        normalizeText(els.idOuChave?.value) ||
        normalizeText(els.consultaIdentificador?.value) ||
        normalizeText(els.documentoIdentificador?.value)
    );
}

export function openLastDocument(type) {
    const identificador = getLastIdentifier();
    if (!identificador) {
        setFeedback(
            `Nenhum identificador disponível para abrir o ${type.toUpperCase()}.`,
            'error'
        );
        return;
    }
    openUrl(type === 'pdf' ? ROUTES.pdf(identificador) : ROUTES.xml(identificador));
}

export function openManualDocument(type) {
    try {
        const { identificador } = validateDocumentoForm(readDocumentoForm());
        openUrl(
            type === 'pdf' ? ROUTES.pdf(identificador) : ROUTES.xml(identificador)
        );
        setFeedback(`Abrindo ${type.toUpperCase()} da CC-e...`, 'info');
    } catch (error) {
        setFeedback(parseErrorMessage(error), 'error');
    }
}

export function clearAll() {
    clearFormFields();
    clearSelectedInvoice();
    updateCorrecaoCounter();
    clearResultadoEmissao();
    clearDetalhesEvento();
    setJsonPreview(els.jsonConsultaStatus, {});
    setJsonPreview(els.jsonHistoricoRemoto, {});
    renderEventos([]);
    setFeedback('Tela limpa com sucesso.', 'info');
}
