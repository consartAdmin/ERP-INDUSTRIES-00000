// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeInutilizarEvents.render.js — Tabela, detalhes e feedback visual  ║
// ║ MODULE: NF-e Inutilização de Numeração                              ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { state } from './nfeInutilizarEvents.state.js';
import {
  escapeHtml,
  formatCnpj,
  formatDateTime,
  getMessageText,
  prettyJson,
  safeJsonString,
  truncate,
} from './nfeInutilizarEvents.utils.js';
import {
  getDisplayStatus,
  getDisplayStatusClass,
} from './nfeInutilizarEvents.validation.js';

/* =======================================================================
 * Feedback / loading states
 * ======================================================================= */
export function setFeedback(el, message, type = 'info') {
  if (!el?.feedback) return;

  el.feedback.textContent = message || 'Pronto para operação.';
  el.feedback.className = 'nfei-feedback';
  el.feedback.dataset.type = type;

  if (type) el.feedback.classList.add(`is-${type}`);
}

export function setTableStatus(el, message) {
  if (!el?.tableStatus) return;
  el.tableStatus.textContent = message || '—';
}

export function setTotalRows(el, total) {
  if (!el?.totalRows) return;
  el.totalRows.textContent = String(total ?? 0);
}

export function setSubmitLoading(el, loading) {
  state.submitting = Boolean(loading);

  if (!el?.btnSubmit) return;
  el.btnSubmit.disabled = state.submitting;
  el.btnSubmit.textContent = state.submitting
    ? 'Enviando...'
    : 'Enviar inutilização';
}

export function setRefreshLoading(el, loading) {
  if (!el?.btnRefresh) return;
  el.btnRefresh.disabled = Boolean(loading);
  el.btnRefresh.textContent = loading
    ? 'Atualizando...'
    : 'Atualizar lista';
}

export function setDetailLoading(el, loading) {
  state.loadingDetail = Boolean(loading);

  if (loading && el?.detailsPanel) {
    el.detailsPanel.innerHTML = `
      <div class="nfei-empty-box">Carregando detalhes...</div>
    `;
  }
}

/* =======================================================================
 * Tabela
 * ======================================================================= */
function getRowMessage(item) {
  if (typeof item?.message === 'string') return item.message;
  if (item?.message != null) return safeJsonString(item.message);
  return '';
}

function renderEmptyRow(el) {
  el.tbodyInutilizacoes.innerHTML = `
    <tr>
      <td colspan="11" class="nfei-empty">Nenhum registro encontrado.</td>
    </tr>
  `;
}

function renderRow(item) {
  const displayStatus = getDisplayStatus(item);

  const rawMessage = getRowMessage(item);
  const escapedMessage = rawMessage ? escapeHtml(rawMessage) : '—';

  const protocol = item?.protocol ? escapeHtml(String(item.protocol)) : '—';
  const cnpj = item?.companyCnpj ? formatCnpj(item.companyCnpj) : '—';
  const faixa = `${item?.numberStart ?? '—'} → ${item?.numberEnd ?? '—'}`;
  const createdAt = formatDateTime(item?.createdAt);
  const id = escapeHtml(String(item?.id ?? ''));

  return `
    <tr data-id="${id}">
      <td class="mono">${escapeHtml(String(item?.id ?? '—'))}</td>

      <td>
        <span class="status-chip ${getDisplayStatusClass(item)}">
          ${escapeHtml(displayStatus)}
        </span>
      </td>

      <td class="mono">${escapeHtml(cnpj)}</td>
      <td>${escapeHtml(String(item?.model ?? '—'))}</td>
      <td>${escapeHtml(String(item?.serie ?? '—'))}</td>
      <td class="mono">${escapeHtml(faixa)}</td>
      <td>${escapeHtml(String(item?.year ?? '—'))}</td>
      <td class="mono">${protocol}</td>
      <td title="${escapedMessage}">${truncate(escapedMessage, 80)}</td>
      <td>${escapeHtml(createdAt)}</td>

      <td>
        <div class="row-actions">
          <button type="button" data-action="view" data-id="${id}">
            Detalhes
          </button>
        </div>
      </td>
    </tr>
  `;
}

export function renderTable(el) {
  const items = Array.isArray(state.items) ? state.items : [];

  setTotalRows(el, items.length);

  if (!el?.tbodyInutilizacoes) return;

  if (!items.length) {
    renderEmptyRow(el);
    return;
  }

  el.tbodyInutilizacoes.innerHTML = items.map(renderRow).join('');
}

/* =======================================================================
 * Detalhes
 * ======================================================================= */
function detailItem(label, value) {
  return `
    <div class="nfei-detail-item">
      <label>${escapeHtml(label)}</label>
      <div>${value ?? '—'}</div>
    </div>
  `;
}

export function renderDetailsError(el, id, error) {
  if (el?.detailTitleBadge) {
    el.detailTitleBadge.textContent = `Registro #${id}`;
  }

  if (el?.detailsPanel) {
    el.detailsPanel.innerHTML = `
      <div class="nfei-empty-box">
        Não foi possível carregar os detalhes: ${escapeHtml(error?.message || 'Erro desconhecido')}
      </div>
    `;
  }
}

export function renderDetails(el, item) {
  if (!el?.detailsPanel) return;

  if (!item) {
    if (el.detailTitleBadge) {
      el.detailTitleBadge.textContent = 'Detalhes';
    }

    el.detailsPanel.innerHTML = `
      <div class="nfei-empty-box">Registro não encontrado.</div>
    `;
    return;
  }

  const displayStatus = getDisplayStatus(item);

  if (el.detailTitleBadge) {
    el.detailTitleBadge.textContent = `#${item?.id ?? '—'} • ${displayStatus}`;
  }

  el.detailsPanel.innerHTML = `
    <div class="nfei-detail-grid">
      ${detailItem('ID', escapeHtml(String(item?.id ?? '—')))}
      ${detailItem(
        'Status',
        `<span class="status-chip ${getDisplayStatusClass(item)}">${escapeHtml(displayStatus)}</span>`
      )}
      ${detailItem(
        'CNPJ',
        `<span class="mono">${escapeHtml(formatCnpj(item?.companyCnpj || '')) || '—'}</span>`
      )}
      ${detailItem('Modelo', escapeHtml(String(item?.model ?? '—')))}

      ${detailItem('Série', escapeHtml(String(item?.serie ?? '—')))}
      ${detailItem(
        'Número inicial',
        `<span class="mono">${escapeHtml(String(item?.numberStart ?? '—'))}</span>`
      )}
      ${detailItem(
        'Número final',
        `<span class="mono">${escapeHtml(String(item?.numberEnd ?? '—'))}</span>`
      )}
      ${detailItem('Ano', escapeHtml(String(item?.year ?? '—')))}

      ${detailItem(
        'Protocolo',
        `<span class="mono">${escapeHtml(item?.protocol || '—')}</span>`
      )}
      ${detailItem('Locked', escapeHtml(String(Boolean(item?.locked))))}
      ${detailItem('Criado em', escapeHtml(formatDateTime(item?.createdAt)))}
      ${detailItem('Atualizado em', escapeHtml(formatDateTime(item?.updatedAt)))}
    </div>

    <div class="nfei-detail-item" style="margin-bottom:14px;">
      <label>Justificativa</label>
      <div>${escapeHtml(item?.justification || '—')}</div>
    </div>

    <div class="nfei-detail-item" style="margin-bottom:14px;">
      <label>Mensagem</label>
      <div>${escapeHtml(getMessageText(item?.message))}</div>
    </div>

    <div class="nfei-json-block">
      <h3>Request Payload</h3>
      <pre>${escapeHtml(prettyJson(item?.requestPayload))}</pre>
    </div>

    <div class="nfei-json-block">
      <h3>Response Payload</h3>
      <pre>${escapeHtml(prettyJson(item?.responsePayload))}</pre>
    </div>

    <div class="nfei-json-block">
      <h3>XML Request</h3>
      <pre>${escapeHtml(item?.xmlRequest || '—')}</pre>
    </div>

    <div class="nfei-json-block">
      <h3>XML Response</h3>
      <pre>${escapeHtml(item?.xmlResponse || '—')}</pre>
    </div>
  `;
}
