// ╔══════════════════════════════════════════════════════════════════════╗
// ║ index.js — CRM Deals (PRODNEX ERP)                                  ║
// ║ Entrypoint do módulo                                                 ║
// ║ ✅ Filtro vendedor inteligente                                        ║
// ║ ✅ Inicializa stages, deals, statusTypes, leadSources, outcomes      ║
// ║ ✅ Summary topo agora usa outcomes                                   ║
// ║ ✅ Clique nos quadrados do topo abre modal das operações concluídas  ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { cacheDom, dom } from './dom.js';
import { state, setCurrentSeller } from './state.js';

import {
  loadStages,
  loadDeals,
  loadSellers,
  loadStatusTypes,
  loadLeadSources,
  loadDealOutcomes,
  loadOutcomesSummary,
} from './loaders.js';

import { renderStages } from './render.stages.js';
import { renderDeals } from './render.deals.js';
import { attachDynamicEvents } from './dragdrop.columns.js';
import {
  renderLeadConclusionZones,
  attachConclusionDropzones,
} from './dropzones.conclusion.js';

import { apiBase } from './config.js';
import { cssEscapeAttr } from './helpers.js';

import {
  openNewCardModal,
  closeNewCardModal,
  saveDealFromModal,
  bindModalCustomerPicker,
  bindModalSellerPicker,
  initNewCardModalBinds,
} from './modal.newCard.js';

import { openCrmSellerSearchModal } from '/public/modalsSearch/crmConsartModalsSearch.js';
import { initKanbanSettings } from './settings.kanban.js';
import { initCustomerFilters } from './filters.customer.js';

import {
  initConclusionSummaryModal,
  bindConclusionSummaryCards,
  decorateConclusionSummaryCards,
} from '../crmConclusionSummaryModal/crmConclusionSummaryModal.js';

/* --------------------------------------------------------------------- */
/* Helpers: escopo real via deals                                        */
/* --------------------------------------------------------------------- */
function getScopedSellerIdsFromDeals() {
  const ids = new Set();

  (state.deals || []).forEach((d) => {
    const n = Number(d?.seller_id);
    if (Number.isFinite(n) && n > 0) ids.add(n);
  });

  return Array.from(ids);
}

function resolveSellerNameById(id) {
  const sid = Number(id);
  const found = (state.sellers || []).find((s) => Number(s?.id) === sid);
  return found?.nome || found?.name || `Vendedor #${sid}`;
}

/* --------------------------------------------------------------------- */
/* Helpers: seller atual                                                 */
/* --------------------------------------------------------------------- */
function getCurrentSellerIdForSummaryModal() {
  if (!state?.currentSeller) return null;
  if (String(state.currentSeller) === 'all') return null;

  const numeric = Number(state.currentSeller);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

/* --------------------------------------------------------------------- */
/* Helpers: mapear códigos de conclusão no summary topo                  */
/* --------------------------------------------------------------------- */
function inferConclusionCodeFromCard(card) {
  if (!card) return '';

  const fromDataset =
    card.dataset?.conclusionCode ||
    card.getAttribute('data-conclusion-code') ||
    card.dataset?.outcomeCode ||
    card.getAttribute('data-outcome-code') ||
    '';

  if (fromDataset) return String(fromDataset).trim();

  const rawText = String(card.textContent || '')
    .trim()
    .toLowerCase();

  if (
    rawText.includes('sem contato') ||
    rawText.includes('perdido') ||
    rawText.includes('lost_no_contact')
  ) {
    return 'lost_no_contact';
  }

  if (
    rawText.includes('queda de venda') ||
    rawText.includes('sales_drop')
  ) {
    return 'sales_drop';
  }

  if (
    rawText.includes('conversão em vendas') ||
    rawText.includes('conversao em vendas') ||
    rawText.includes('won_sale')
  ) {
    return 'won_sale';
  }

  return '';
}

function enhanceOutcomeSummaryCards() {
  if (!dom.outcomeSummary) return;

  const candidates = Array.from(
    dom.outcomeSummary.querySelectorAll(
      [
        '[data-conclusion-code]',
        '[data-outcome-code]',
        '.crm-outcomes-summary__card',
        '.crm-outcome-summary-card',
        '.crm-summary-card',
        '.crm-kpi-card',
      ].join(', ')
    )
  );

  candidates.forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    if (node.classList.contains('crm-outcomes-summary__placeholder')) return;

    // Ignora containers/wrappers que possuem outros cards dentro deles
    if (
      node.querySelector(
        '.crm-outcomes-summary__card, .crm-outcome-summary-card, .crm-summary-card, .crm-kpi-card, [data-conclusion-code], [data-outcome-code]'
      )
    ) {
      return;
    }

    const explicitCode =
      node.dataset.conclusionCode ||
      node.getAttribute('data-conclusion-code') ||
      node.dataset.outcomeCode ||
      node.getAttribute('data-outcome-code') ||
      '';

    const code = explicitCode || inferConclusionCodeFromCard(node);
    if (!code) return;

    node.dataset.conclusionCode = code;
    node.classList.add('crm-conclusion-summary-card');
  });

  decorateConclusionSummaryCards();
  bindConclusionSummaryCards('.crm-conclusion-summary-card');
}

/* --------------------------------------------------------------------- */
/* UI: Meu vendedor                                                      */
/* --------------------------------------------------------------------- */
function ensureMySellerLabel() {
  if (!dom.selectSeller) return null;

  let label = document.getElementById('crm-my-seller-label');
  if (label) return label;

  label = document.createElement('div');
  label.id = 'crm-my-seller-label';
  label.className = 'crm-my-seller-label hidden';

  const parent = dom.selectSeller.parentElement;
  if (parent) {
    parent.insertBefore(label, dom.selectSeller);
  } else {
    document.body.appendChild(label);
  }

  return label;
}

function showMySellerLabel(sellerName) {
  const label = ensureMySellerLabel();
  if (!label) return;

  label.textContent = `Meu vendedor: ${sellerName}`;
  label.classList.remove('hidden');

  if (dom.selectSeller) dom.selectSeller.classList.add('hidden');
}

function hideMySellerLabel() {
  const label = document.getElementById('crm-my-seller-label');
  if (label) label.classList.add('hidden');

  if (dom.selectSeller) dom.selectSeller.classList.remove('hidden');
}

/* --------------------------------------------------------------------- */
/* UI: preencher filtro                                                  */
/* --------------------------------------------------------------------- */
function fillSellerFilter() {
  if (!dom.selectSeller) return;

  const scopedSellerIds = getScopedSellerIdsFromDeals();
  const sellersList = Array.isArray(state.sellers) ? state.sellers : [];

  dom.selectSeller.innerHTML = '<option value="all">Todos os vendedores</option>';

  const useScopeFilter = scopedSellerIds.length > 0;

  const sellersToRender = useScopeFilter
    ? sellersList.filter((v) => scopedSellerIds.includes(Number(v?.id)))
    : sellersList;

  sellersToRender.forEach((v) => {
    const opt = document.createElement('option');
    opt.value = v.id;
    opt.textContent = v.nome || v.name || `Vendedor #${v.id}`;
    dom.selectSeller.appendChild(opt);
  });

  if (scopedSellerIds.length === 1) {
    const onlyId = String(scopedSellerIds[0]);

    let opt = dom.selectSeller.querySelector(`option[value="${cssEscapeAttr(onlyId)}"]`);
    if (!opt) {
      opt = document.createElement('option');
      opt.value = onlyId;
      opt.textContent = resolveSellerNameById(onlyId);
      dom.selectSeller.appendChild(opt);
    }

    dom.selectSeller.value = onlyId;
    setCurrentSeller(onlyId);

    dom.selectSeller.disabled = true;
    showMySellerLabel(resolveSellerNameById(onlyId));
    return;
  }

  dom.selectSeller.disabled = false;
  hideMySellerLabel();

  if (state.currentSeller !== 'all') {
    const exists = !!dom.selectSeller.querySelector(
      `option[value="${cssEscapeAttr(String(state.currentSeller))}"]`
    );

    if (!exists) {
      dom.selectSeller.value = 'all';
      setCurrentSeller('all');
    } else {
      dom.selectSeller.value = String(state.currentSeller);
    }
  } else {
    dom.selectSeller.value = 'all';
  }
}

/* --------------------------------------------------------------------- */
/* Refresh parcial do módulo                                             */
/* --------------------------------------------------------------------- */
async function refreshDealsAndSummary() {
  await loadDeals();
  renderDeals();

  await loadOutcomesSummary();
  enhanceOutcomeSummaryCards();

  fillSellerFilter();
}

/* --------------------------------------------------------------------- */
/* Static events                                                         */
/* --------------------------------------------------------------------- */
function attachStaticEvents() {
  if (dom.selectSeller && dom.selectSeller.dataset.boundChangeSeller !== '1') {
    dom.selectSeller.dataset.boundChangeSeller = '1';

    dom.selectSeller.addEventListener('change', async (e) => {
      if (dom.selectSeller.disabled) return;

      setCurrentSeller(e.target.value);
      await refreshDealsAndSummary();
    });
  }

  if (dom.selectSeller && dom.selectSeller.dataset.boundDblclickSellerSearch !== '1') {
    dom.selectSeller.dataset.boundDblclickSellerSearch = '1';

    dom.selectSeller.addEventListener('dblclick', () => {
      if (dom.selectSeller.disabled) return;

      openCrmSellerSearchModal({
        apiBase,
        onPick(seller) {
          const id = String(seller.id);

          let opt = dom.selectSeller.querySelector(`option[value="${cssEscapeAttr(id)}"]`);
          if (!opt) {
            opt = document.createElement('option');
            opt.value = id;
            opt.textContent = seller.name || seller.nome || `Vendedor #${seller.id}`;
            dom.selectSeller.appendChild(opt);
          }

          dom.selectSeller.value = id;
          setCurrentSeller(id);

          refreshDealsAndSummary().catch((error) => {
            console.error('[CRM Deals] erro ao atualizar após selecionar vendedor:', error);
          });
        },
      });
    });
  }

  if (dom.btnAddCard && dom.btnAddCard.dataset.boundOpenNewCard !== '1') {
    dom.btnAddCard.dataset.boundOpenNewCard = '1';
    dom.btnAddCard.addEventListener('click', openNewCardModal);
  }

  bindModalCustomerPicker();
  bindModalSellerPicker();

  if (dom.btnModalSave && dom.btnModalSave.dataset.boundSaveDeal !== '1') {
    dom.btnModalSave.dataset.boundSaveDeal = '1';

    dom.btnModalSave.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await saveDealFromModal();
      await refreshDealsAndSummary();
    });
  }

  if (dom.btnModalCancel && dom.btnModalCancel.dataset.boundCloseModal !== '1') {
    dom.btnModalCancel.dataset.boundCloseModal = '1';
    dom.btnModalCancel.addEventListener('click', closeNewCardModal);
  }

  // ESC, X e backdrop do modal ficam com o /includes/js/modal.js

  if (dom.outcomeSummary && dom.outcomeSummary.dataset.boundOutcomeClick !== '1') {
    dom.outcomeSummary.dataset.boundOutcomeClick = '1';

    dom.outcomeSummary.addEventListener('click', (e) => {
      const card = e.target?.closest?.('.crm-conclusion-summary-card, [data-conclusion-code]');
      if (!card) return;

      const code = card.dataset.conclusionCode || '';
      if (!code) return;

      console.log('[Conclusão Summary] clicado:', code);
    });
  }

  initNewCardModalBinds();
}

/* --------------------------------------------------------------------- */
/* Modal de resumo por conclusão                                         */
/* --------------------------------------------------------------------- */
function initTopSummaryConclusionModal() {
  initConclusionSummaryModal({
    apiBase,
    autoBindCards: false,
    getLocalDeals: () => state.deals || [],
    sellerIdGetter: () => getCurrentSellerIdForSummaryModal(),
    onRowClick: ({ dealId, conclusionCode }) => {
      console.log('[CRM Deals] linha clicada no modal:', { dealId, conclusionCode });

      // Espaço preparado para futura ação:
      // - abrir modal de detalhes do card
      // - navegar para o card
      // - destacar card na coluna
    },
  });
}

/* --------------------------------------------------------------------- */
/* INIT                                                                  */
/* --------------------------------------------------------------------- */
(async function initCrmDeals() {
  try {
    cacheDom();
    attachStaticEvents();
    initTopSummaryConclusionModal();

    // ⚙️ layout do Kanban, salvo por usuário (uma configuração por CRM)
    initKanbanSettings({
      mount: document.querySelector('.crm-actions'),
      key: window.CRM_COMPANY === 'CONSART' ? 'crmConsartErp.kanban' : 'crmDeals.kanban',
    });

    await loadStages();
    await loadDeals();
    await loadSellers();
    await loadStatusTypes();
    await loadLeadSources();
    await loadDealOutcomes();

    renderStages();
    renderDeals();

    fillSellerFilter();

    attachDynamicEvents();
    renderLeadConclusionZones();
    attachConclusionDropzones();

    await loadOutcomesSummary();
    enhanceOutcomeSummaryCards();

    // Estado / Cidade / Segmento (só nas telas que têm esses filtros)
    await initCustomerFilters(async () => {
      await loadDeals();
      renderDeals();
    });

    console.log('[CRM Deals] inicializado com sucesso');
  } catch (err) {
    console.error('[CRM Deals] Erro na inicialização:', err);
  }
})();