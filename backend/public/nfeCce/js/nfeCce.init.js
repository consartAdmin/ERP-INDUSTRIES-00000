/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ FILE: nfeCce.init.js                                               ║
   ║ MODULE: NF-e | Carta de Correção Eletrônica (CC-e)                 ║
   ║ DESCRIPTION: Ponto de entrada do frontend CC-e                     ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

'use strict';

import {
    clearAll,
    onConsultarStatus,
    onEmitirCce,
    onValidarCampos,
    openLastDocument,
    openManualDocument,
} from './nfeCce.actions.js';
import {
    onBuscarHistorico,
    onTabelaEventosClick,
    openSelectedEventDocument,
} from './nfeCce.history.js';
import {
    clearDetalhesEvento,
    clearResultadoEmissao,
    renderEventos,
    switchTab,
    updateCorrecaoCounter,
} from './nfeCce.render.js';
import { bindCceModal, isAnyCceModalOpen } from './nfeCce.modal.js';
import {
    onBuscarNfesEmitidas,
    onTabelaNfesEmitidasClick,
    renderNfesEmitidas,
} from './nfeCce.invoices.js';
import { els } from './nfeCce.state.js';
import { setFeedback, setJsonPreview } from './nfeCce.utils.js';

function bindTabs() {
    els.tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            switchTab(tab.dataset.tab);

            if (tab.dataset.tab === 'tab-historico') {
                void onBuscarHistorico();
            }
        });
    });
}

function bindActions() {
    els.correcao?.addEventListener('input', updateCorrecaoCounter);
    els.btnExecutarBuscaNfeEmitida?.addEventListener('click', onBuscarNfesEmitidas);
    els.tbodyNfesEmitidas?.addEventListener('click', onTabelaNfesEmitidasClick);
    els.buscaNfeEmitida?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            void onBuscarNfesEmitidas();
        }
    });
    els.btnBuscarNfeEmitida?.addEventListener('click', () => {
        setTimeout(() => void onBuscarNfesEmitidas(), 0);
    });
    els.btnValidarCampos?.addEventListener('click', onValidarCampos);
    els.btnEmitirCce?.addEventListener('click', onEmitirCce);
    els.btnLimparTela?.addEventListener('click', clearAll);
    els.btnConsultarStatus?.addEventListener('click', onConsultarStatus);
    els.btnAbrirPdfUltimo?.addEventListener('click', () => openLastDocument('pdf'));
    els.btnAbrirXmlUltimo?.addEventListener('click', () => openLastDocument('xml'));
    els.btnAbrirPdf?.addEventListener('click', () => openManualDocument('pdf'));
    els.btnAbrirXml?.addEventListener('click', () => openManualDocument('xml'));
    els.btnBuscarHistorico?.addEventListener('click', onBuscarHistorico);
    els.btnAtualizarHistorico?.addEventListener('click', onBuscarHistorico);
    els.btnAbrirPdfEvento?.addEventListener('click', () =>
        openSelectedEventDocument('pdf')
    );
    els.btnAbrirXmlEvento?.addEventListener('click', () =>
        openSelectedEventDocument('xml')
    );
    els.tbodyEventosSalvos?.addEventListener('click', onTabelaEventosClick);
}

function bindKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
        const target = event.target;
        const isTyping =
            target &&
            (target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.tagName === 'SELECT' ||
                target.isContentEditable);

        if (event.key === 'F5') return;

        if (event.key === 'Escape' && isAnyCceModalOpen()) return;

        if (event.ctrlKey && event.key.toLowerCase() === 'enter') {
            event.preventDefault();
            onEmitirCce();
            return;
        }

        if (!isTyping && event.key === 'Escape') {
            event.preventDefault();
            clearAll();
        }
    });
}

export async function init() {
    bindTabs();
    bindActions();
    bindCceModal();
    bindKeyboardShortcuts();
    updateCorrecaoCounter();
    clearResultadoEmissao();
    clearDetalhesEvento();
    setJsonPreview(els.jsonRetorno, {});
    setJsonPreview(els.jsonConsultaStatus, {});
    setJsonPreview(els.jsonHistoricoRemoto, {});
    renderEventos([]);
    renderNfesEmitidas([]);
    switchTab('tab-emissao');
    await onBuscarHistorico();
}

document.addEventListener('DOMContentLoaded', init);
