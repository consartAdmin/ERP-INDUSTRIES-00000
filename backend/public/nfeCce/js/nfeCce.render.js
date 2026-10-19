/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ FILE: nfeCce.render.js                                             ║
   ║ MODULE: NF-e | Carta de Correção Eletrônica (CC-e)                 ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

'use strict';

import { els, state } from './nfeCce.state.js';
import {
    canOpenDocumentFromRow,
    formatDateTime,
    setJsonPreview,
} from './nfeCce.utils.js';

export function switchTab(tabId) {
    els.tabs.forEach((tab) => {
        tab.classList.toggle('active', tab.dataset.tab === tabId);
    });
    els.panels.forEach((panel) => {
        panel.classList.toggle('active', panel.id === tabId);
    });
}

export function updateCorrecaoCounter() {
    const value = els.correcao?.value || '';
    if (els.contadorCorrecao) {
        els.contadorCorrecao.textContent = `${value.length} / 1000`;
    }
}

export function clearResultadoEmissao() {
    if (els.retornoStatus) els.retornoStatus.textContent = '—';
    if (els.retornoProtocolo) els.retornoProtocolo.textContent = '—';
    if (els.retornoSequencia) els.retornoSequencia.textContent = '—';
    if (els.retornoCstat) els.retornoCstat.textContent = '—';

    setJsonPreview(els.jsonRetorno, {});
    state.ultimoStatusPayload = null;
    state.ultimoIdentificador = '';

    if (els.btnAbrirPdfUltimo) els.btnAbrirPdfUltimo.disabled = true;
    if (els.btnAbrirXmlUltimo) els.btnAbrirXmlUltimo.disabled = true;
}

export function clearDetalhesEvento() {
    if (els.detNfeKey) els.detNfeKey.textContent = '—';
    if (els.detPlugnotasId) els.detPlugnotasId.textContent = '—';
    if (els.detProtocolo) els.detProtocolo.textContent = '—';
    if (els.detStatus) els.detStatus.textContent = '—';
    if (els.detRespostaSefaz) els.detRespostaSefaz.textContent = '—';
    if (els.detCorrecao) els.detCorrecao.value = '';

    if (els.btnAbrirPdfEvento) els.btnAbrirPdfEvento.disabled = true;
    if (els.btnAbrirXmlEvento) els.btnAbrirXmlEvento.disabled = true;
    state.ultimoEventoSelecionado = null;
}

export function renderStatus(extracted) {
    if (els.retornoStatus) els.retornoStatus.textContent = extracted.status;
    if (els.retornoProtocolo) {
        els.retornoProtocolo.textContent = extracted.protocolo;
    }
    if (els.retornoSequencia) {
        els.retornoSequencia.textContent = extracted.numeroSequencia;
    }
    if (els.retornoCstat) els.retornoCstat.textContent = extracted.cstat;
}

function getEventStatus(row = {}) {
    const raw = row.raw_response || row.rawResponse || {};

    return (
        row.status ||
        raw?.status?.data?.status ||
        raw?.status?.data?.situacao ||
        raw?.status?.message ||
        raw?.envio?.message ||
        '—'
    );
}

function getEventCstat(row = {}) {
    const raw = row.raw_response || row.rawResponse || {};

    return (
        row.cstat ||
        raw?.status?.data?.cStat ||
        raw?.status?.data?.cstat ||
        raw?.status?.data?.codigo ||
        '—'
    );
}

export function renderEventos(eventos = []) {
    state.eventosSalvos = Array.isArray(eventos) ? eventos : [];

    if (els.cceTableInfo) {
        const total = state.eventosSalvos.length;
        els.cceTableInfo.textContent =
            `${total} ${total === 1 ? 'evento encontrado' : 'eventos encontrados'}`;
    }

    if (!els.tbodyEventosSalvos) return;

    if (!state.eventosSalvos.length) {
        els.tbodyEventosSalvos.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">Nenhum evento encontrado.</td>
            </tr>
        `;
        clearDetalhesEvento();
        return;
    }

    els.tbodyEventosSalvos.innerHTML = state.eventosSalvos
        .map((row, index) => {
            const id = row.id ?? index;
            const enabled = canOpenDocumentFromRow(row);

            const status = getEventStatus(row);
            const cstat = getEventCstat(row);

            return `
        <tr data-event-id="${id}">
            <td>${row.numero_sequencia ?? row.numeroSequencia ?? '—'}</td>
            <td>${row.nfe_number || row.nfeNumber || '—'}</td>
            <td>${row.customer_name || row.customerName || '—'}</td>
            <td>${row.protocolo || '—'}</td>
            <td>${status}</td>
            <td>${cstat}</td>
            <td>${row.created_by || row.createdBy || '—'}</td>
            <td>${formatDateTime(row.created_at || row.createdAt)}</td>

            <td>
                <button
                    type="button"
                    class="btn-row-action"
                    data-action="select"
                    data-event-id="${id}">
                    Selecionar
                </button>
            </td>

            <td>
                <button
                    type="button"
                    class="btn-row-action"
                    data-action="pdf"
                    data-event-id="${id}"
                    ${enabled ? '' : 'disabled'}>
                    PDF
                </button>

                <button
                    type="button"
                    class="btn-row-action"
                    data-action="xml"
                    data-event-id="${id}"
                    ${enabled ? '' : 'disabled'}>
                    XML
                </button>
            </td>
        </tr>
    `;
        })
        .join('');

    selectEvento(state.eventosSalvos[0].id ?? 0);
}

export function selectEvento(eventId) {
    const selected = state.eventosSalvos.find(
        (row, index) => String(row.id ?? index) === String(eventId)
    );

    if (!selected) {
        clearDetalhesEvento();
        return;
    }

    state.ultimoEventoSelecionado = selected;
    if (els.detNfeKey) {
        els.detNfeKey.textContent = selected.nfe_key || selected.nfeKey || '—';
    }
    if (els.detPlugnotasId) {
        els.detPlugnotasId.textContent =
            selected.nfe_plugnotas_id || selected.nfePlugnotasId || '—';
    }
    if (els.detProtocolo) els.detProtocolo.textContent = selected.protocolo || '—';
    if (els.detStatus) els.detStatus.textContent = selected.status || '—';
    if (els.detRespostaSefaz) {
        els.detRespostaSefaz.textContent =
            selected.resposta_sefaz || selected.respostaSefaz || '—';
    }
    if (els.detCorrecao) els.detCorrecao.value = selected.correcao || '';

    const enabled = canOpenDocumentFromRow(selected);
    if (els.btnAbrirPdfEvento) els.btnAbrirPdfEvento.disabled = !enabled;
    if (els.btnAbrirXmlEvento) els.btnAbrirXmlEvento.disabled = !enabled;

    els.tbodyEventosSalvos?.querySelectorAll('tr').forEach((row) => {
        row.classList.toggle(
            'selected',
            String(row.dataset.eventId) === String(selected.id ?? eventId)
        );
    });
}
