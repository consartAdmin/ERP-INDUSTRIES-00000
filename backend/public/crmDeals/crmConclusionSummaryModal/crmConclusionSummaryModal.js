/* ╔══════════════════════════════════════════════════════════════════════╗
 * ║ crmConclusionSummaryModal.js                                        ║
 * ║ CRM Deals — Controle do modal de operações concluídas               ║
 * ║ Path: /public/crmDeals/crmConclusionSummaryModal/                   ║
 * ║                                                                      ║
 * ║ ✅ Abre/fecha modal                                                  ║
 * ║ ✅ Busca no backend por conclusão                                    ║
 * ║ ✅ Fallback local se a API falhar                                    ║
 * ║ ✅ Suporta clique e teclado nos cards                               ║
 * ╚══════════════════════════════════════════════════════════════════════╝ */

'use strict';

import {
  fetchConclusionOperations,
  normalizeConclusionCode,
  normalizeOperation,
  humanizeConclusionCode,
  sumOperationsValue,
} from './crmConclusionSummaryApi.js';

import {
  ensureConclusionSummaryModalMarkup,
  getConclusionSummaryModalRefs,
  renderConclusionSummaryLoading,
  renderConclusionSummaryEmpty,
  renderConclusionSummaryTable,
  renderConclusionSummaryError,
} from './crmConclusionSummaryRender.js';

/* --------------------------------------------------------------------- */
/* State                                                                 */
/* --------------------------------------------------------------------- */

const modalState = {
  initialized: false,
  currentConclusionCode: '',
  onRowClick: null,
  getLocalDeals: null,
  sellerIdGetter: null,
  abortController: null,
};

/* --------------------------------------------------------------------- */
/* Public API                                                            */
/* --------------------------------------------------------------------- */

export function initConclusionSummaryModal(options = {}) {
  if (typeof options.getLocalDeals === 'function') {
    modalState.getLocalDeals = options.getLocalDeals;
  }

  if (typeof options.onRowClick === 'function') {
    modalState.onRowClick = options.onRowClick;
  }

  if (typeof options.sellerIdGetter === 'function') {
    modalState.sellerIdGetter = options.sellerIdGetter;
  }

  ensureConclusionSummaryModalMarkup(options);
  bindModalEvents();

  if (options.autoBindCards !== false) {
    bindConclusionSummaryCards(options.cardSelector);
  }

  modalState.initialized = true;
}

export function bindConclusionSummaryCards(
  cardSelector = '.crm-conclusion-summary-card, [data-conclusion-code]'
) {
  const nodes = Array.from(document.querySelectorAll(cardSelector));

  nodes.forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    if (node.dataset.crmConclusionSummaryBound === 'true') return;

    node.style.cursor = node.style.cursor || 'pointer';
    node.setAttribute('role', node.getAttribute('role') || 'button');
    node.setAttribute('tabindex', node.getAttribute('tabindex') || '0');

    node.addEventListener('click', handleSummaryCardActivate);
    node.addEventListener('keydown', handleSummaryCardKeydown);

    node.dataset.crmConclusionSummaryBound = 'true';
  });
}

export async function openConclusionSummaryModal(conclusionCode) {
  ensureConclusionSummaryModalMarkup();

  const normalizedCode = normalizeConclusionCode(conclusionCode);
  modalState.currentConclusionCode = normalizedCode;

  const refs = getConclusionSummaryModalRefs();
  if (!refs.root) return null;

  abortPendingRequest();
  modalState.abortController = new AbortController();

  showModal();
  renderConclusionSummaryLoading(normalizedCode);

  try {
    const payload = await fetchConclusionOperations(normalizedCode, {
      signal: modalState.abortController.signal,
    });

    renderConclusionSummaryTable(payload);
    attachRowClickEvents();

    return payload;
  } catch (error) {
    if (error?.name === 'AbortError') {
      return null;
    }

    console.warn('[CRM Conclusion Modal] API falhou. Tentando fallback local...', error);

    try {
      const sellerId =
        typeof modalState.sellerIdGetter === 'function'
          ? modalState.sellerIdGetter()
          : null;

      const payload = buildLocalFallbackPayload(normalizedCode, sellerId);

      if (payload.items.length > 0) {
        renderConclusionSummaryTable(payload);
        attachRowClickEvents();
        return payload;
      }

      renderConclusionSummaryEmpty(normalizedCode);

      return {
        ok: true,
        source: 'local-empty',
        conclusionCode: normalizedCode,
        items: [],
        totalCount: 0,
        totalValue: 0,
      };
    } catch (fallbackError) {
      renderConclusionSummaryError(fallbackError, normalizedCode);

      return {
        ok: false,
        source: 'local-error',
        conclusionCode: normalizedCode,
        items: [],
        totalCount: 0,
        totalValue: 0,
        error: fallbackError,
      };
    }
  }
}

export function closeConclusionSummaryModal() {
  const refs = getConclusionSummaryModalRefs();
  if (!refs.root) return;

  abortPendingRequest();

  refs.root.hidden = true;
  refs.root.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('crm-conclusion-summary-modal-open');
}

export function isConclusionSummaryModalOpen() {
  const refs = getConclusionSummaryModalRefs();
  return Boolean(refs.root && !refs.root.hidden);
}

/* --------------------------------------------------------------------- */
/* Internal binds                                                        */
/* --------------------------------------------------------------------- */

function bindModalEvents() {
  const refs = getConclusionSummaryModalRefs();
  if (!refs.root || refs.root.dataset.bound === 'true') return;

  refs.backdrop?.addEventListener('click', closeConclusionSummaryModal);
  refs.close?.addEventListener('click', closeConclusionSummaryModal);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isConclusionSummaryModalOpen()) {
      closeConclusionSummaryModal();
    }
  });

  refs.root.dataset.bound = 'true';
}

function handleSummaryCardActivate(event) {
  const node = event.currentTarget;
  if (!(node instanceof HTMLElement)) return;

  const code =
    node.dataset.conclusionCode ||
    node.getAttribute('data-conclusion-code') ||
    '';

  if (!code) return;

  openConclusionSummaryModal(code).catch((error) => {
    console.error('[CRM] Error opening conclusion summary modal:', error);
  });
}

function handleSummaryCardKeydown(event) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  handleSummaryCardActivate(event);
}

function attachRowClickEvents() {
  const refs = getConclusionSummaryModalRefs();
  if (!refs.tbody) return;

  const rows = refs.tbody.querySelectorAll('.crm-conclusion-summary-modal__row');

  rows.forEach((row) => {
    if (!(row instanceof HTMLElement)) return;
    if (row.dataset.boundRowClick === 'true') return;

    row.style.cursor = 'pointer';

    row.addEventListener('click', () => {
      const dealId = row.dataset.dealId || '';
      if (typeof modalState.onRowClick === 'function') {
        modalState.onRowClick({
          dealId,
          conclusionCode: modalState.currentConclusionCode,
          row,
        });
      }
    });

    row.dataset.boundRowClick = 'true';
  });
}

/* --------------------------------------------------------------------- */
/* Local data fallback                                                   */
/* --------------------------------------------------------------------- */

function buildLocalFallbackPayload(conclusionCode, sellerId = null) {
  const rawDeals =
    typeof modalState.getLocalDeals === 'function'
      ? modalState.getLocalDeals()
      : [];

  const targetCode = normalizeConclusionCode(conclusionCode);

  const outcomeCodeMap = {
    lost_no_contact: {
      ids: [],
      names: ['sem contato / perdido', 'sem contato', 'perdido', 'lost no contact'],
    },
    sales_drop: {
      ids: [],
      names: ['queda de venda', 'sales drop'],
    },
    won_sale: {
      ids: [],
      names: ['conversão em vendas', 'conversao em vendas', 'won sale'],
    },
  };

  const expected = outcomeCodeMap[targetCode] || { ids: [], names: [] };

  const items = (Array.isArray(rawDeals) ? rawDeals : [])
    .map((deal) => normalizeOperation(deal, ''))
    .filter((deal) => {
      const raw = deal.raw || {};

      const normalizedDirectCode = normalizeConclusionCode(
        deal.conclusionCode ||
          raw.outcome_code ||
          raw.conclusion_code ||
          raw.closed_reason_code ||
          raw.status_code ||
          raw.deal_outcome_code ||
          raw.crm_outcome_code ||
          raw.code ||
          raw.outcome?.code ||
          raw.conclusion?.code ||
          ''
      );

      const normalizedName = normalizeConclusionCode(
        deal.conclusionName ||
          raw.outcome_name ||
          raw.conclusion_name ||
          raw.closed_reason_name ||
          raw.deal_outcome_name ||
          raw.crm_outcome_name ||
          raw.outcome?.name ||
          raw.conclusion?.name ||
          raw.name ||
          ''
      );

      const outcomeId =
        Number(
          raw.outcome_id ??
            raw.conclusion_id ??
            raw.closed_reason_id ??
            raw.deal_outcome_id ??
            raw.crm_outcome_id ??
            raw.outcome?.id ??
            raw.conclusion?.id ??
            0
        ) || 0;

      const isClosed =
        deal.isClosed === true ||
        raw.is_closed === true ||
        Number(raw.is_closed) === 1 ||
        String(raw.is_closed || '').trim().toLowerCase() === 'true' ||
        raw.closed === true ||
        Number(raw.closed) === 1 ||
        raw.finalized === true ||
        Number(raw.finalized) === 1 ||
        String(raw.status || '').trim().toLowerCase() === 'closed' ||
        String(raw.stage_type || '').trim().toLowerCase() === 'final' ||
        String(raw.stage_name || '').trim().toLowerCase() === 'processo finalizado';

      const sellerMatches =
        !sellerId ||
        Number(deal.sellerId || raw.seller_id || raw.vendor_id || 0) === Number(sellerId);

      const codeMatches =
        normalizedDirectCode === targetCode ||
        expected.names.includes(normalizedName) ||
        expected.ids.includes(outcomeId);

      return isClosed && sellerMatches && codeMatches;
    })
    .map((deal) => ({
      ...deal,
      conclusionCode: targetCode,
      conclusionName: deal.conclusionName || humanizeConclusionCode(targetCode),
    }));

  console.log('[CRM Conclusion Modal] targetCode:', targetCode);
  console.log('[CRM Conclusion Modal] rawDeals:', rawDeals);
  console.log('[CRM Conclusion Modal] filteredItems:', items);

  return {
    ok: true,
    source: 'local-fallback',
    conclusionCode: targetCode,
    items,
    totalCount: items.length,
    totalValue: sumOperationsValue(items),
  };
}

function showModal() {
  const refs = getConclusionSummaryModalRefs();
  if (!refs.root) return;

  refs.root.hidden = false;
  refs.root.setAttribute('aria-hidden', 'false');
  document.body.classList.add('crm-conclusion-summary-modal-open');
}

function abortPendingRequest() {
  if (modalState.abortController) {
    try {
      modalState.abortController.abort();
    } catch {}
  }
  modalState.abortController = null;
}

/* --------------------------------------------------------------------- */
/* Helpers                                                               */
/* --------------------------------------------------------------------- */

export function decorateConclusionSummaryCards(summaryMap = {}) {
  const nodes = Array.from(
    document.querySelectorAll('.crm-conclusion-summary-card, [data-conclusion-code]')
  );

  nodes.forEach((node) => {
    if (!(node instanceof HTMLElement)) return;

    const rawCode =
      node.dataset.conclusionCode ||
      node.getAttribute('data-conclusion-code') ||
      '';

    const code = normalizeConclusionCode(rawCode);
    const summary = summaryMap[code] || null;

    if (!node.dataset.conclusionCode && code) {
      node.dataset.conclusionCode = code;
    }

    node.title = `Clique para ver as operações de "${humanizeConclusionCode(code)}"`;

    if (summary && typeof summary.count !== 'undefined') {
      node.dataset.count = String(summary.count);
    }

    if (summary && typeof summary.totalValue !== 'undefined') {
      node.dataset.totalValue = String(summary.totalValue);
    }
  });
}