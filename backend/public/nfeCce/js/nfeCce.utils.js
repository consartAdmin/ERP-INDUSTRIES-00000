/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ FILE: nfeCce.utils.js                                              ║
   ║ MODULE: NF-e | Carta de Correção Eletrônica (CC-e)                 ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

'use strict';

import { els } from './nfeCce.state.js';

export function normalizeText(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export function toJsonPretty(value) {
    try {
        return JSON.stringify(value ?? {}, null, 2);
    } catch {
        return '{}';
    }
}

export function setFeedback(message, type = 'info') {
    if (!els.feedback) return;
    els.feedback.className = `feedback ${type}`;
    els.feedback.textContent = message || '—';
}

export function setJsonPreview(element, data) {
    if (!element) return;
    element.textContent = toJsonPretty(data);
}

export function parseErrorMessage(error, fallback = 'Ocorreu um erro.') {
    if (!error) return fallback;
    if (typeof error === 'string') return error;
    return error.message || fallback;
}

export function formatDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? String(value)
        : date.toLocaleString('pt-BR');
}

export function pickFirst(...values) {
    return values.find(
        (value) =>
            value !== undefined &&
            value !== null &&
            String(value).trim() !== ''
    ) ?? null;
}

export function extractEventStatus(data = {}) {
    const root = data?.data ?? data ?? {};

    return {
        protocolo: pickFirst(
            root.protocolo,
            root.protocol,
            root.nProt,
            root.numeroProtocolo
        ) || '—',
        numeroSequencia: pickFirst(
            root.numeroSequencia,
            root.sequencia,
            root.sequence,
            root.seqEvento
        ) || '—',
        status: pickFirst(
            root.status,
            root.situacao,
            root.descricaoSituacao,
            root.resposta
        ) || '—',
        cstat: pickFirst(
            root.cStat,
            root.cstat,
            root.codigo,
            root.statusCodigo
        ) || '—',
        respostaSefaz: pickFirst(
            root.respostaSefaz,
            root.xMotivo,
            root.motivo,
            root.message,
            root.mensagem
        ) || '—',
        pdfUrl: pickFirst(root.pdf, root.pdfUrl, root.urlPdf),
        xmlUrl: pickFirst(root.xml, root.xmlUrl, root.urlXml),
    };
}

export function openUrl(url) {
    window.open(url, '_blank', 'noopener,noreferrer');
}

export function getBestEventIdentifier(row) {
    if (!row) return '';

    return String(
        row.nfe_plugnotas_id ||
        row.nfePlugnotasId ||
        row.protocolo ||
        row.nfe_key ||
        row.nfeKey ||
        ''
    ).trim();
}

export function canOpenDocumentFromRow(row) {
    return Boolean(getBestEventIdentifier(row));
}
