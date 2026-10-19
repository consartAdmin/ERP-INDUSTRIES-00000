// ╔══════════════════════════════════════════════════════════════════════╗
// ║ cancelarNfe.render.js — Renderização de NF-e, resumo e status      ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  $,
  escapeHtml,
  formatCpfCnpj,
  formatDate,
  formatMoney,
  normalizeText,
  setRetornoApi,
} from './cancelarNfe.utils.js';

import { state } from './cancelarNfe.state.js';

import {
  isAuthorizedStatus,
  normalizeNfeStatusCode,
} from './cancelarNfe.validation.js';

export function setLoading(isLoading) {
  $('#loadingBox')?.classList.toggle(
    'hidden',
    !isLoading
  );

  const ids = [
    'btnConsultar',
    'btnCancelar',
    'btnLimpar',
    'btnBuscarNfeEmitida',
    'btnBuscarNfeStatus',
  ];

  for (const id of ids) {
    const el = $(`#${id}`);
    if (el) el.disabled = isLoading;
  }
}

export function setStatusBadge(
  statusText = 'Aguardando consulta',
  variant = 'neutral'
) {
  const el = $('#statusBadge');
  if (!el) return;

  el.textContent = statusText;
  el.className = `badge badge-${variant}`;
}

export function inferStatusVariant(status) {
  const s = normalizeNfeStatusCode(status);

  if (!s) return 'neutral';
  if (s === 'AUTORIZADO') return 'success';
  if (s === 'CANCELADO') return 'danger';
  if (s === 'REJEITADO') return 'danger';
  if (s === 'DENEGADO') return 'danger';
  if (s === 'INUTILIZADO') return 'danger';
  if (s === 'ERRO') return 'danger';
  if (s === 'PROCESSANDO') return 'primary';

  return 'neutral';
}

export function clearInfo() {
  const ids = [
    'nfSituacao',
    'nfNumero',
    'nfChave',
    'nfProtocolo',
    'nfCliente',
    'nfDocumento',
    'modalNfSituacao',
    'modalNfNumero',
    'modalNfChave',
    'modalNfProtocolo',
    'modalNfCliente',
    'modalNfDocumento',
  ];

  for (const id of ids) {
    const el = $(`#${id}`);
    if (el) el.textContent = '—';
  }

  setStatusBadge(
    'Aguardando consulta',
    'neutral'
  );

  setRetornoApi(
    'Nenhuma operação executada ainda.'
  );
}

export function fillResumo(resumo = {}) {
  const destinatario =
    resumo?.destinatario ||
    resumo?.cliente ||
    resumo?.dest ||
    {};

  const situacao =
    resumo?.situacao ||
    resumo?.status ||
    resumo?.situacaoNfe ||
    resumo?.descricaoSituacao ||
    resumo?.statusNfe ||
    'NÃO INFORMADO';

  const numero =
    resumo?.numero ||
    resumo?.numeroNfe ||
    resumo?.nfe_number ||
    resumo?.numNfe ||
    state.nfeSelecionada?.nfe_number ||
    '—';

  const chave =
    resumo?.chaveAcesso ||
    resumo?.chave_acesso ||
    resumo?.chave ||
    resumo?.chaveNfe ||
    resumo?.chaveNFe ||
    state.nfeSelecionada?.nfe_key ||
    '—';

  const protocolo =
    resumo?.protocolo ||
    resumo?.protocoloAutorizacao ||
    resumo?.protocoloSefaz ||
    state.nfeSelecionada?.nfe_protocol ||
    '—';

  const cliente =
    destinatario?.razaoSocial ||
    destinatario?.nome ||
    resumo?.clienteNome ||
    resumo?.razaoSocial ||
    state.nfeSelecionada?.customer_name ||
    '—';

  const documento =
    destinatario?.cpfCnpj ||
    destinatario?.documento ||
    resumo?.cpfCnpj ||
    resumo?.cnpjCpf ||
    state.nfeSelecionada?.customer_tax_id ||
    '—';

  const values = {
    nfSituacao: normalizeText(situacao),
    modalNfSituacao: normalizeText(situacao),
    nfNumero: normalizeText(numero),
    modalNfNumero: normalizeText(numero),
    nfChave: normalizeText(chave),
    modalNfChave: normalizeText(chave),
    nfProtocolo: normalizeText(protocolo),
    modalNfProtocolo: normalizeText(protocolo),
    nfCliente: normalizeText(cliente),
    modalNfCliente: normalizeText(cliente),
    nfDocumento: formatCpfCnpj(documento),
    modalNfDocumento: formatCpfCnpj(documento),
  };

  for (const [id, value] of Object.entries(values)) {
    const el = $(`#${id}`);
    if (el) el.textContent = value;
  }

  setStatusBadge(
    normalizeText(situacao, 'Status indefinido'),
    inferStatusVariant(situacao)
  );
}

export function renderNfesEmitidas(rows = []) {
  const tbody = $('#tbodyNfesEmitidas');
  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center">
          Nenhuma NF-e emitida encontrada.
        </td>
      </tr>
    `;

    const info = $('#nfesEmitidasInfo');
    if (info) {
      info.textContent = '0 NF-e encontrada';
    }

    return;
  }

  tbody.innerHTML = rows
    .map((row, index) => {
      const authorized =
        isAuthorizedStatus(row.nfe_status);

      return `
        <tr>
          <td>${escapeHtml(row.invoice_id || '—')}</td>
          <td>${escapeHtml(row.nfe_number || '—')}</td>
          <td>${escapeHtml(row.order_number || row.order_id || '—')}</td>
          <td title="${escapeHtml(row.nfe_key)}">
            ${escapeHtml(row.nfe_key || '—')}
          </td>
          <td>
            ${escapeHtml(normalizeNfeStatusCode(row.nfe_status) || '—')}
          </td>
          <td>${escapeHtml(formatDate(row.issued_at || row.issued_date))}</td>
          <td>${escapeHtml(formatMoney(row.total_amount))}</td>
          <td>
            <button
              type="button"
              class="btn btn-new btn-sm"
              data-select-invoice-index="${index}"
              ${authorized ? '' : 'disabled'}
              title="${
                authorized
                  ? 'Selecionar NF-e'
                  : 'Somente NF-e AUTORIZADA pode ser cancelada'
              }"
            >
              Selecionar
            </button>
          </td>
        </tr>
      `;
    })
    .join('');

  const info = $('#nfesEmitidasInfo');
  if (info) {
    info.textContent =
      `${rows.length} NF-e(s) encontrada(s)`;
  }
}

export function renderCancellationStatus(result = {}) {
  const status =
    result?.statusCancelamento ||
    (
      result?.cancellationCompleted
        ? 'CONCLUIDO'
        : result?.cancellationRejected
          ? 'REJEITADO'
          : result?.cancellationError
            ? 'ERRO'
            : 'PROCESSANDO'
    );

  const variant =
    status === 'CONCLUIDO'
      ? 'danger'
      : status === 'REJEITADO' || status === 'ERRO'
        ? 'danger'
        : 'primary';

  setStatusBadge(
    status === 'CONCLUIDO'
      ? 'CANCELADO'
      : `Cancelamento: ${status}`,
    variant
  );

  setRetornoApi(result);
}
