/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ FILE: nfeCce.invoices.js                                           ║
   ║ MODULE: NF-e | Carta de Correção Eletrônica (CC-e)                 ║
   ║ DESCRIPTION: Seleção de NF-e emitida a partir de invoicesIssued    ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

'use strict';

import { listarNfesEmitidas } from './nfeCce.api.js';
import { closeNfeEmitidaModal } from './nfeCce.modal.js';
import { els, state } from './nfeCce.state.js';
import { normalizeText, parseErrorMessage, setFeedback } from './nfeCce.utils.js';

function pick(row, ...keys) {
    for (const key of keys) {
        const value = row?.[key];
        if (value !== undefined && value !== null && String(value).trim() !== '') {
            return value;
        }
    }
    return '';
}

function normalizeInvoice(row) {
    return {
        invoice_id: pick(row, 'invoice_id', 'invoiceId', 'id'),
        order_id: pick(row, 'order_id', 'orderId'),
        nfe_number: pick(row, 'nfe_number', 'nfeNumber', 'numero'),
        nfe_key: pick(row, 'nfe_key', 'nfeKey', 'chave'),
        nfe_status: pick(row, 'nfe_status', 'nfeStatus', 'status'),
        nfe_protocol: pick(row, 'nfe_protocol', 'nfeProtocol', 'protocol'),
        nfe_environment: pick(row, 'nfe_environment', 'nfeEnvironment', 'environment'),
        issued_at: pick(row, 'issued_at', 'issuedAt'),
        issued_date: pick(row, 'issued_date', 'issuedDate'),
        total_amount: pick(row, 'total_amount', 'totalAmount', 'valorTotal'),
        nfe_provider_id: pick(
            row,
            'nfe_provider_id',
            'nfeProviderId',
            'nfe_plugnotas_id',
            'nfePlugnotasId',
            'provider_id',
            'providerId'
        ),
        raw: row,
    };
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function formatMoney(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '—';
    return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('pt-BR');
}

export function renderNfesEmitidas(rows = []) {
    if (!els.tbodyNfesEmitidas) return;

    if (!rows.length) {
        els.tbodyNfesEmitidas.innerHTML = `
            <tr>
                <td colspan="8" class="text-center">Nenhuma NF-e emitida encontrada.</td>
            </tr>`;
        if (els.nfesEmitidasInfo) els.nfesEmitidasInfo.textContent = '0 NF-e encontrada';
        return;
    }

    els.tbodyNfesEmitidas.innerHTML = rows.map((row, index) => `
        <tr>
            <td>${escapeHtml(row.invoice_id || '—')}</td>
            <td>${escapeHtml(row.nfe_number || '—')}</td>
            <td>${escapeHtml(row.order_id || '—')}</td>
            <td title="${escapeHtml(row.nfe_key)}">${escapeHtml(row.nfe_key || '—')}</td>
            <td>${escapeHtml(row.nfe_status || '—')}</td>
            <td>${escapeHtml(formatDate(row.issued_at || row.issued_date))}</td>
            <td>${escapeHtml(formatMoney(row.total_amount))}</td>
            <td>
                <button type="button" class="btn btn-new btn-sm" data-select-invoice-index="${index}">
                    Selecionar
                </button>
            </td>
        </tr>`).join('');

    if (els.nfesEmitidasInfo) {
        els.nfesEmitidasInfo.textContent = `${rows.length} NF-e(s) encontrada(s)`;
    }
}

export async function onBuscarNfesEmitidas() {
    try {
        const search = normalizeText(els.buscaNfeEmitida?.value);
        if (els.nfesEmitidasInfo) els.nfesEmitidasInfo.textContent = 'Carregando...';

        const rows = await listarNfesEmitidas(search);
        state.nfesEmitidas = rows.map(normalizeInvoice);
        renderNfesEmitidas(state.nfesEmitidas);
    } catch (error) {
        state.nfesEmitidas = [];
        renderNfesEmitidas([]);
        setFeedback(
            parseErrorMessage(error, 'Falha ao carregar as NF-e emitidas.'),
            'error'
        );
    }
}

export function applyInvoiceToCce(invoice) {
    if (!invoice) return;

    state.nfeEmitidaSelecionada = invoice;

    if (els.invoiceId) els.invoiceId.value = invoice.invoice_id || '';
    if (els.nfeNumber) els.nfeNumber.value = invoice.nfe_number || '';
    if (els.orderId) els.orderId.value = invoice.order_id || '';
    if (els.nfeKey) els.nfeKey.value = invoice.nfe_key || '';
    if (els.nfePlugnotasId) els.nfePlugnotasId.value = invoice.nfe_provider_id || '';

    // O endpoint atual da CC-e aceita idOuChave. Prioriza o ID do provedor
    // e usa a chave de 44 dígitos como fallback.
    if (els.idOuChave) {
        els.idOuChave.value = invoice.nfe_provider_id || invoice.nfe_key || '';
    }

    setFeedback(
        `NF-e ${invoice.nfe_number || invoice.invoice_id || ''} carregada de invoicesIssued.`,
        'success'
    );

    closeNfeEmitidaModal();
    els.correcao?.focus();
}

export function onTabelaNfesEmitidasClick(event) {
    const button = event.target.closest('[data-select-invoice-index]');
    if (!button) return;

    const index = Number(button.dataset.selectInvoiceIndex);
    const invoice = state.nfesEmitidas[index];
    if (!invoice) return;

    applyInvoiceToCce(invoice);
}

export function clearSelectedInvoice() {
    state.nfeEmitidaSelecionada = null;
    state.nfesEmitidas = [];
    if (els.invoiceId) els.invoiceId.value = '';
    if (els.nfeNumber) els.nfeNumber.value = '';
    if (els.buscaNfeEmitida) els.buscaNfeEmitida.value = '';
    renderNfesEmitidas([]);
}
