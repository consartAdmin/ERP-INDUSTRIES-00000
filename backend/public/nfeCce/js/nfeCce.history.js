/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ FILE: nfeCce.history.js                                            ║
   ║ MODULE: NF-e | Carta de Correção Eletrônica (CC-e)                 ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

'use strict';

import { buscarHistorico } from './nfeCce.api.js';
import { ROUTES } from './nfeCce.config.js';
import { readHistoricoFilters } from './nfeCce.form.js';
import { openEventDetailsModal } from './nfeCce.modal.js';
import { renderEventos, selectEvento } from './nfeCce.render.js';
import { els, state } from './nfeCce.state.js';
import {
    getBestEventIdentifier,
    openUrl,
    parseErrorMessage,
    setFeedback,
    setJsonPreview,
} from './nfeCce.utils.js';

export async function onBuscarHistorico() {
    if (state.historicoCarregando) return;

    state.historicoCarregando = true;
    if (els.btnBuscarHistorico) els.btnBuscarHistorico.disabled = true;
    if (els.btnAtualizarHistorico) els.btnAtualizarHistorico.disabled = true;

    try {
        setFeedback('Buscando histórico de CC-e...', 'info');
        const data = await buscarHistorico(readHistoricoFilters());

        const salvos = Array.isArray(data?.data?.salvos)
            ? data.data.salvos
            : [];

        renderEventos(salvos);
        setJsonPreview(els.jsonHistoricoRemoto, data?.data?.remoto || {});

        setFeedback(
            salvos.length
                ? `${salvos.length} evento(s) de CC-e carregado(s).`
                : 'Nenhum evento de CC-e salvo foi encontrado.',
            salvos.length ? 'success' : 'info'
        );
    } catch (error) {
        renderEventos([]);
        setJsonPreview(els.jsonHistoricoRemoto, {});
        setFeedback(
            parseErrorMessage(error, 'Falha ao buscar histórico.'),
            'error'
        );
    } finally {
        state.historicoCarregando = false;
        if (els.btnBuscarHistorico) els.btnBuscarHistorico.disabled = false;
        if (els.btnAtualizarHistorico) els.btnAtualizarHistorico.disabled = false;
    }
}

export function onTabelaEventosClick(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const { action, eventId } = button.dataset;
    const row = state.eventosSalvos.find(
        (item, index) => String(item.id ?? index) === String(eventId)
    );
    if (!row) return;

    if (action === 'select') {
        selectEvento(eventId);
        openEventDetailsModal();
        return;
    }

    const identifier = getBestEventIdentifier(row);
    if (!identifier) {
        setFeedback(
            'Nenhum identificador válido encontrado para este evento.',
            'error'
        );
        return;
    }

    if (action === 'pdf') openUrl(ROUTES.pdf(identifier));
    if (action === 'xml') openUrl(ROUTES.xml(identifier));
}

export function openSelectedEventDocument(type) {
    const identifier = getBestEventIdentifier(state.ultimoEventoSelecionado);
    if (!identifier) {
        setFeedback(
            'Nenhum identificador válido encontrado para o evento selecionado.',
            'error'
        );
        return;
    }

    openUrl(type === 'pdf' ? ROUTES.pdf(identifier) : ROUTES.xml(identifier));
}