// ╔══════════════════════════════════════════════════════════════════════╗
// ║ loaders.js — CRM Deals (PRODNEX ERP)                                ║
// ║ loadStages / loadDeals / loadSellers / loadStatusTypes              ║
// ║ loadLeadSources / loadDealOutcomes / loadLossReasons / loadSummary  ║
// ║ ✔ Compatível com APIs que retornam { ok } ou { success }            ║
// ║ ✔ LossReasons preload para modal de perda                           ║
// ║ ✔ Normalização segura de arrays                                     ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  state,
  setStages,
  setDeals,
  setSellers,
  setStatusTypes,
  setLeadSources,
  setDealOutcomes,
  setLossReasons,
} from './state.js';

import { dom } from './dom.js';
import { getCustomerFilterParams } from './filters.customer.js';
import { normalizeCode } from './helpers.js';
import { fillStatusTypesSelect, fillLeadSourcesSelect } from './modal.newCard.js';

import {
  mergeDealOutcomesWithSummary,
  renderOutcomesSummary,
  renderLeadConclusionZones,
} from './dropzones.conclusion.js';

import {
  fetchStages,
  fetchDeals,
  fetchStatusTypes,
  fetchLeadSources,
  fetchDealOutcomes,
  fetchLossReasons,
  fetchOutcomesSummary,
} from './api.js';

import { fetchJSON } from './fetchJSON.js';
import { apiUrl } from './config.js';

export {
  loadStages,
  loadDeals,
  loadSellers,
  loadStatusTypes,
  loadLeadSources,
  loadDealOutcomes,
  loadLossReasons,
  loadOutcomesSummary,
};

/* --------------------------------------------------------------------- */
/* Helpers                                                               */
/* --------------------------------------------------------------------- */

function isApiOk(json) {
  return json?.ok === true || json?.success === true;
}

function normalizeList(json) {
  if (!json) return [];

  if (Array.isArray(json)) return json;
  if (Array.isArray(json.data)) return json.data;
  if (Array.isArray(json.rows)) return json.rows;

  /* fetchJSON wrapper:
     { ok:true, data:{ success:true, data:[...] } }
  */
  if (json.data && typeof json.data === 'object') {
    if (Array.isArray(json.data.data)) return json.data.data;
    if (Array.isArray(json.data.rows)) return json.data.rows;
  }

  /* backend direct wrapper:
     { success:true, data:[...] }
  */
  if (Array.isArray(json?.payload)) return json.payload;

  return [];
}

/* --------------------------------------------------------------------- */
/* Stages                                                                */
/* --------------------------------------------------------------------- */

async function loadStages() {
  try {
    const json = await fetchStages();

    if (!isApiOk(json)) {
      throw new Error(json?.error || json?.message || 'STAGES_LOAD_ERROR');
    }

    const rows = normalizeList(json);

    const stages = rows
      .filter((s) => s.active !== false && s.is_active !== false)
      .map((s) => ({
        ...s,
        code_norm: normalizeCode(s.code || ''),
      }))
      .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));

    setStages(stages);
  } catch (err) {
    console.error('[CRM] Erro ao carregar stages:', err);
    setStages([]);
  }
}

/* --------------------------------------------------------------------- */
/* Deals                                                                 */
/* --------------------------------------------------------------------- */

async function loadDeals() {
  try {
    const json = await fetchDeals({
      sellerId: state.currentSeller !== 'all'
        ? state.currentSeller
        : undefined,
      ...getCustomerFilterParams(),
      limit: 500,
      offset: 0,
    });

    if (!isApiOk(json)) {
      throw new Error(json?.error || json?.message || 'DEALS_LOAD_ERROR');
    }

    const rows = normalizeList(json);

    const normalizedDeals = rows.map((d) => ({
      ...d,
      stage_code_norm: normalizeCode(
        d?.stage_code ||
        d?.stageCode ||
        d?.stage ||
        ''
      ),
    }));

    setDeals(normalizedDeals);
  } catch (err) {
    console.error('[CRM] Erro ao carregar deals:', err);
    setDeals([]);
  }
}

/* --------------------------------------------------------------------- */
/* Sellers                                                               */
/* --------------------------------------------------------------------- */

async function loadSellers() {
  try {
    const json = await fetchJSON(apiUrl('/sellers'));

    if (!isApiOk(json)) {
      throw new Error(json?.error || json?.message || 'SELLERS_LOAD_ERROR');
    }

    setSellers(normalizeList(json));
  } catch (err) {
    console.error('[CRM] Erro ao carregar vendedores:', err);
    setSellers([]);
  }
}

/* --------------------------------------------------------------------- */
/* Status Types                                                          */
/* --------------------------------------------------------------------- */

async function loadStatusTypes() {
  try {
    const json = await fetchStatusTypes();

    if (!isApiOk(json)) {
      throw new Error(json?.error || json?.message || 'STATUS_TYPES_LOAD_ERROR');
    }

    const list = normalizeList(json)
      .filter((s) => s.active !== false && s.is_active !== false)
      .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));

    setStatusTypes(list);
    fillStatusTypesSelect(false);
  } catch (err) {
    console.error('[CRM] Erro ao carregar status-types:', err);
    setStatusTypes([]);
    fillStatusTypesSelect(true);
  }
}

/* --------------------------------------------------------------------- */
/* Lead Sources                                                          */
/* --------------------------------------------------------------------- */

async function loadLeadSources() {
  try {
    const json = await fetchLeadSources();

    if (!isApiOk(json)) {
      throw new Error(json?.error || json?.message || 'LEAD_SOURCES_LOAD_ERROR');
    }

    const list = normalizeList(json)
      .filter((s) => s.active !== false && s.is_active !== false)
      .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));

    setLeadSources(list);
    fillLeadSourcesSelect(false);
  } catch (err) {
    console.error('[CRM] Erro ao carregar lead-sources:', err);
    setLeadSources([]);
    fillLeadSourcesSelect(true);
  }
}

/* --------------------------------------------------------------------- */
/* Deal Outcomes                                                         */
/* --------------------------------------------------------------------- */

async function loadDealOutcomes() {
  try {
    const json = await fetchDealOutcomes();

    if (!isApiOk(json)) {
      throw new Error(json?.error || json?.message || 'DEAL_OUTCOMES_LOAD_ERROR');
    }

    const list = normalizeList(json)
      .filter((s) => s.active !== false && s.is_active !== false)
      .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));

    setDealOutcomes(list);

    if (dom.conclusionZones) {
      renderLeadConclusionZones();
    }
  } catch (err) {
    console.error('[CRM] Erro ao carregar deal-outcomes:', err);
    setDealOutcomes([]);

    if (dom.conclusionZones) {
      renderLeadConclusionZones();
    }
  }
}

/* --------------------------------------------------------------------- */
/* Loss Reasons                                                          */
/* --------------------------------------------------------------------- */

async function loadLossReasons() {
  try {
    if (Array.isArray(state.lossReasons) && state.lossReasons.length) {
      return state.lossReasons;
    }

    const json = await fetchLossReasons();

    if (!isApiOk(json)) {
      throw new Error(json?.error || json?.message || 'LOSS_REASONS_LOAD_ERROR');
    }

    const rows = normalizeList(json);

    const list = rows
      .filter((s) => s?.is_active !== false && s?.active !== false)
      .sort((a, b) => Number(a?.id ?? 0) - Number(b?.id ?? 0));

    setLossReasons(list);

    return list;
  } catch (err) {
    console.error('[CRM] Erro ao carregar loss-reasons:', err);
    setLossReasons([]);
    return [];
  }
}

/* --------------------------------------------------------------------- */
/* Summary Topo — Outcomes                                               */
/* --------------------------------------------------------------------- */

async function loadOutcomesSummary() {
  if (!dom.outcomeSummary) return;

  try {
    if (!Array.isArray(state.dealOutcomes) || !state.dealOutcomes.length) {
      await loadDealOutcomes();
      renderLeadConclusionZones();
    }

    const json = await fetchOutcomesSummary({
      sellerId: state.currentSeller !== 'all'
        ? state.currentSeller
        : undefined,
    });

    if (!isApiOk(json)) {
      throw new Error(json?.error || json?.message || 'OUTCOMES_SUMMARY_ERROR');
    }

    const summaryData =
      json?.data && typeof json.data === 'object' && !Array.isArray(json.data)
        ? json.data
        : {};

    const items = mergeDealOutcomesWithSummary(
      state.dealOutcomes,
      summaryData
    );

    renderOutcomesSummary(items);
  } catch (err) {
    console.error('[CRM] Erro ao carregar resumo de outcomes:', err);
    renderOutcomesSummary(null);
  }
}