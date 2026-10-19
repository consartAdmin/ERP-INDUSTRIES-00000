/* ╔══════════════════════════════════════════════════════════════════════╗
 * ║ crmConclusionSummaryRender.js                                       ║
 * ║ CRM Deals — Render do modal de operações concluídas                 ║
 * ║ Path: /public/crmDeals/crmConclusionSummaryModal/                   ║
 * ║                                                                      ║
 * ║ Responsabilidades:                                                  ║
 * ║ • Garantir o markup do modal                                        ║
 * ║ • Renderizar loading / erro / vazio / tabela                        ║
 * ║ • Formatar moeda, datas e badges                                    ║
 * ╚══════════════════════════════════════════════════════════════════════╝ */

'use strict';

import {
  humanizeConclusionCode,
  sumOperationsValue,
} from './crmConclusionSummaryApi.js';

/* --------------------------------------------------------------------- */
/* Selectors / IDs                                                       */
/* --------------------------------------------------------------------- */

const IDS = {
  root: 'crmConclusionSummaryModal',
  backdrop: 'crmConclusionSummaryModalBackdrop',
  dialog: 'crmConclusionSummaryModalDialog',
  close: 'crmConclusionSummaryModalClose',
  title: 'crmConclusionSummaryModalTitle',
  subtitle: 'crmConclusionSummaryModalSubtitle',
  meta: 'crmConclusionSummaryModalMeta',
  body: 'crmConclusionSummaryModalBody',
  tbody: 'crmConclusionSummaryModalTbody',
};

/* --------------------------------------------------------------------- */
/* Public API                                                            */
/* --------------------------------------------------------------------- */

export function ensureConclusionSummaryModalMarkup(options = {}) {
  const existing = document.getElementById(IDS.root);
  if (existing) return existing;

  const mountTarget =
    options.mountTarget ||
    document.body ||
    document.documentElement;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = buildModalHtml(options).trim();

  const root = wrapper.firstElementChild;
  mountTarget.appendChild(root);

  return root;
}

export function getConclusionSummaryModalRefs() {
  return {
    root: document.getElementById(IDS.root),
    backdrop: document.getElementById(IDS.backdrop),
    dialog: document.getElementById(IDS.dialog),
    close: document.getElementById(IDS.close),
    title: document.getElementById(IDS.title),
    subtitle: document.getElementById(IDS.subtitle),
    meta: document.getElementById(IDS.meta),
    body: document.getElementById(IDS.body),
    tbody: document.getElementById(IDS.tbody),
  };
}

export function renderConclusionSummaryLoading(conclusionCode) {
  ensureConclusionSummaryModalMarkup();

  const refs = getConclusionSummaryModalRefs();
  const title = humanizeConclusionCode(conclusionCode);

  if (refs.title) refs.title.textContent = `Operações — ${title}`;
  if (refs.subtitle) refs.subtitle.textContent = 'Carregando operações concluídas...';
  if (refs.meta) {
    refs.meta.innerHTML = renderMetaBadges({
      count: 0,
      totalValue: 0,
      conclusionCode,
    });
  }

  if (refs.tbody) {
    refs.tbody.innerHTML = `
      <tr>
        <td colspan="8" class="crm-conclusion-summary-modal__empty">
          Carregando operações...
        </td>
      </tr>
    `;
  }
}

export function renderConclusionSummaryError(error, conclusionCode) {
  ensureConclusionSummaryModalMarkup();

  const refs = getConclusionSummaryModalRefs();
  const title = humanizeConclusionCode(conclusionCode);
  const message =
    error?.message ||
    'Não foi possível carregar as operações desta conclusão.';

  if (refs.title) refs.title.textContent = `Operações — ${title}`;
  if (refs.subtitle) refs.subtitle.textContent = 'Falha ao carregar os dados.';
  if (refs.meta) {
    refs.meta.innerHTML = renderMetaBadges({
      count: 0,
      totalValue: 0,
      conclusionCode,
    });
  }

  if (refs.tbody) {
    refs.tbody.innerHTML = `
      <tr>
        <td colspan="8" class="crm-conclusion-summary-modal__empty crm-conclusion-summary-modal__empty--error">
          ${escapeHtml(message)}
        </td>
      </tr>
    `;
  }
}

export function renderConclusionSummaryEmpty(conclusionCode) {
  ensureConclusionSummaryModalMarkup();

  const refs = getConclusionSummaryModalRefs();
  const title = humanizeConclusionCode(conclusionCode);

  if (refs.title) refs.title.textContent = `Operações — ${title}`;
  if (refs.subtitle) refs.subtitle.textContent = 'Nenhuma operação encontrada para esta conclusão.';
  if (refs.meta) {
    refs.meta.innerHTML = renderMetaBadges({
      count: 0,
      totalValue: 0,
      conclusionCode,
    });
  }

  if (refs.tbody) {
    refs.tbody.innerHTML = `
      <tr>
        <td colspan="8" class="crm-conclusion-summary-modal__empty">
          Nenhuma operação concluída encontrada.
        </td>
      </tr>
    `;
  }
}

export function renderConclusionSummaryTable(payload = {}) {
  ensureConclusionSummaryModalMarkup();

  const refs = getConclusionSummaryModalRefs();
  const items = Array.isArray(payload.items) ? payload.items : [];
  const conclusionCode = payload.conclusionCode || '';
  const count = Number(payload.totalCount ?? items.length ?? 0);
  const totalValue = Number(payload.totalValue ?? sumOperationsValue(items));

  if (refs.title) {
    refs.title.textContent = `Operações — ${humanizeConclusionCode(conclusionCode)}`;
  }

  if (refs.subtitle) {
    refs.subtitle.textContent = `${count} operação(ões) concluída(s) encontrada(s).`;
  }

  if (refs.meta) {
    refs.meta.innerHTML = renderMetaBadges({
      count,
      totalValue,
      conclusionCode,
    });
  }

  if (!refs.tbody) return;

  if (!items.length) {
    renderConclusionSummaryEmpty(conclusionCode);
    return;
  }

  refs.tbody.innerHTML = items
    .map((item) => {
      const closedAt = item.closedAt || item.updatedAt || item.createdAt || '';
      const note = item.note ? escapeHtml(item.note) : '—';
      const lossReason = item.lossReasonName ? escapeHtml(item.lossReasonName) : '—';

      return `
        <tr
          class="crm-conclusion-summary-modal__row"
          data-deal-id="${escapeHtml(String(item.dealId || item.id || ''))}"
        >
          <td>${escapeHtml(String(item.id || '—'))}</td>

          <td>
            <div class="crm-conclusion-summary-modal__customer">
              <strong>${escapeHtml(item.customerName || '—')}</strong>
              ${item.phone ? `<span>${escapeHtml(item.phone)}</span>` : ''}
              ${item.email ? `<span>${escapeHtml(item.email)}</span>` : ''}
            </div>
          </td>

          <td>${escapeHtml(item.title || '—')}</td>
          <td>${escapeHtml(item.sellerName || '—')}</td>
          <td class="crm-conclusion-summary-modal__money">${formatMoney(item.value || 0)}</td>
          <td>${escapeHtml(item.stageName || '—')}</td>
          <td>${escapeHtml(formatDateTime(closedAt) || '—')}</td>

          <td>
            <div class="crm-conclusion-summary-modal__details">
              <span class="crm-conclusion-summary-modal__pill">
                ${escapeHtml(item.conclusionName || humanizeConclusionCode(conclusionCode))}
              </span>

              ${
                lossReason !== '—'
                  ? `<span class="crm-conclusion-summary-modal__mini">Motivo: ${lossReason}</span>`
                  : ''
              }

              ${
                note !== '—'
                  ? `<span class="crm-conclusion-summary-modal__mini">Obs.: ${note}</span>`
                  : ''
              }
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
}

/* --------------------------------------------------------------------- */
/* HTML                                                                  */
/* --------------------------------------------------------------------- */

function buildModalHtml(options = {}) {
  const title = escapeHtml(options.defaultTitle || 'Operações da conclusão');
  const subtitle = escapeHtml(options.defaultSubtitle || 'Cards concluídos');

  return `
    <div id="${IDS.root}" class="crm-conclusion-summary-modal" hidden aria-hidden="true">
      <div id="${IDS.backdrop}" class="crm-conclusion-summary-modal__backdrop" data-close="true"></div>

      <section
        id="${IDS.dialog}"
        class="crm-conclusion-summary-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="${IDS.title}"
      >
        <header class="crm-conclusion-summary-modal__header">
          <div class="crm-conclusion-summary-modal__heading">
            <h3 id="${IDS.title}" class="crm-conclusion-summary-modal__title">${title}</h3>
            <p id="${IDS.subtitle}" class="crm-conclusion-summary-modal__subtitle">${subtitle}</p>
          </div>

          <button
            id="${IDS.close}"
            class="crm-conclusion-summary-modal__close"
            type="button"
            aria-label="Fechar modal"
            title="Fechar"
          >
            ×
          </button>
        </header>

        <div id="${IDS.body}" class="crm-conclusion-summary-modal__body">
          <div id="${IDS.meta}" class="crm-conclusion-summary-modal__meta"></div>

          <div class="crm-conclusion-summary-modal__table-wrap">
            <table class="crm-conclusion-summary-modal__table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Cliente</th>
                  <th>Título</th>
                  <th>Vendedor</th>
                  <th>Valor</th>
                  <th>Etapa</th>
                  <th>Data fechamento</th>
                  <th>Detalhes</th>
                </tr>
              </thead>
              <tbody id="${IDS.tbody}">
                <tr>
                  <td colspan="8" class="crm-conclusion-summary-modal__empty">
                    Nenhuma operação encontrada.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  `;
}

/* --------------------------------------------------------------------- */
/* Meta                                                                  */
/* --------------------------------------------------------------------- */

function renderMetaBadges({ count = 0, totalValue = 0, conclusionCode = '' } = {}) {
  return `
    <div class="crm-conclusion-summary-modal__badges">
      <span class="crm-conclusion-summary-modal__badge">
        Conclusão: ${escapeHtml(humanizeConclusionCode(conclusionCode))}
      </span>
      <span class="crm-conclusion-summary-modal__badge">
        Operações: ${escapeHtml(String(count))}
      </span>
      <span class="crm-conclusion-summary-modal__badge">
        Total: ${escapeHtml(formatMoney(totalValue))}
      </span>
    </div>
  `;
}

/* --------------------------------------------------------------------- */
/* Formatters                                                            */
/* --------------------------------------------------------------------- */

export function formatMoney(value) {
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(Number(value || 0));
  } catch {
    return `R$ ${Number(value || 0).toFixed(2)}`;
  }
}

export function formatDateTime(value) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return date.toLocaleString('pt-BR');
  }
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}