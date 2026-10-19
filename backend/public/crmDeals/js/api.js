// ╔══════════════════════════════════════════════════════════════════════╗
// ║ api.js — CRM Deals (PRODNEX ERP)                                    ║
// ║ Todas as chamadas de API                                             ║
// ║                                                                      ║
// ║ ✔ Usa fetchJSON (token automático)                                   ║
// ║ ✔ Nunca usar fetch direto                                            ║
// ║ ✔ Nunca usar JSON.stringify aqui                                     ║
// ║ ✔ Body sempre objeto                                                 ║
// ║ ✔ Validação forte de stage                                           ║
// ║ ✔ Debug seguro                                                       ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { API_ROUTES } from '/public/config/apiRoutes.js';
import { apiUrl } from './config.js';
import { fetchJSON } from './fetchJSON.js';

export {
  fetchStages,
  fetchDeals,
  fetchStatusTypes,
  fetchLeadSources,
  fetchDealOutcomes,
  fetchLossReasons,
  apiCreateLossReason,
  fetchLeadConclusionSummary,
  fetchOutcomesSummary,
  fetchOutcomes,

  moveDealToStage,
  apiSetDealStatusType,
  concludeDealStatusType,
  apiRegisterOutcome,

  apiCreateDeal,
  apiUpdateDeal,
  apiDeleteDeal,
};

/* --------------------------------------------------------------------- */
/* HELPERS                                                               */
/* --------------------------------------------------------------------- */

function toPositiveInt(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeString(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function buildQuery(params = {}) {
  const qs = new URLSearchParams();

  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    qs.set(k, String(v));
  });

  const str = qs.toString();
  return str ? `?${str}` : '';
}

/* --------------------------------------------------------------------- */
/* READS                                                                 */
/* --------------------------------------------------------------------- */

async function fetchStages({ includeInactive = false } = {}) {
  return fetchJSON(
    apiUrl(
      `${API_ROUTES.crm.stages.list}${buildQuery({
        includeInactive: includeInactive ? 'true' : ''
      })}`
    ),
    { method: 'GET' }
  );
}

async function fetchDeals({
  stageCode,
  stageId,
  sellerId,
  search,
  state,
  city,
  segmentId,
  limit,
  offset,
} = {}) {

  const query = buildQuery({
    stageCode,
    stageId: toPositiveInt(stageId),
    sellerId: toPositiveInt(sellerId),
    search,
    state: normalizeString(state),
    city: normalizeString(city),
    segmentId: toPositiveInt(segmentId),
    limit: toPositiveInt(limit),
    offset: Number.isFinite(Number(offset)) ? Number(offset) : undefined,
  });

  return fetchJSON(
    apiUrl(`${API_ROUTES.crm.deals.list}${query}`),
    { method: 'GET' }
  );
}

async function fetchStatusTypes({ includeInactive = false } = {}) {
  return fetchJSON(
    apiUrl(
      `${API_ROUTES.crm.statusTypes.list}${buildQuery({
        includeInactive: includeInactive ? 'true' : ''
      })}`
    ),
    { method: 'GET' }
  );
}

async function fetchLeadSources({ includeInactive = false } = {}) {
  return fetchJSON(
    apiUrl(
      `${API_ROUTES.crm.leadSources.list}${buildQuery({
        includeInactive: includeInactive ? 'true' : ''
      })}`
    ),
    { method: 'GET' }
  );
}

async function fetchDealOutcomes({ includeInactive = false } = {}) {
  return fetchJSON(
    apiUrl(
      `${API_ROUTES.crm.dealOutcomes.list}${buildQuery({
        includeInactive: includeInactive ? 'true' : ''
      })}`
    ),
    { method: 'GET' }
  );
}

async function fetchLossReasons({ includeInactive = false } = {}) {

  const useActiveRoute = !includeInactive;

  return fetchJSON(
    apiUrl(
      useActiveRoute
        ? API_ROUTES.crm.lossReasons.active
        : API_ROUTES.crm.lossReasons.list
    ),
    { method: 'GET' }
  );
}

async function apiCreateLossReason(reasonName) {
  return fetchJSON(apiUrl(API_ROUTES.crm.lossReasons.create), {
    method: 'POST',
    body: { reason_name: reasonName, is_active: true },
  });
}

async function fetchLeadConclusionSummary({ sellerId } = {}) {
  return fetchJSON(
    apiUrl(
      `${API_ROUTES.crm.leadConclusionSummary.list}${buildQuery({
        sellerId: toPositiveInt(sellerId),
      })}`
    ),
    { method: 'GET' }
  );
}

async function fetchOutcomesSummary({ sellerId } = {}) {
  return fetchJSON(
    apiUrl(
      `${API_ROUTES.crm.outcomesSummary.list}${buildQuery({
        sellerId: toPositiveInt(sellerId),
      })}`
    ),
    { method: 'GET', noCache: true }
  );
}

async function fetchOutcomes({
  outcome,
  sellerId,
  search,
  limit,
  offset,
} = {}) {
  return fetchJSON(
    apiUrl(
      `${API_ROUTES.crm.outcomes.list}${buildQuery({
        outcome,
        sellerId: toPositiveInt(sellerId),
        search,
        limit: toPositiveInt(limit),
        offset: Number(offset) || 0
      })}`
    ),
    { method: 'GET' }
  );
}

/* --------------------------------------------------------------------- */
/* MOVE DEAL                                                             */
/* --------------------------------------------------------------------- */

async function moveDealToStage(id, stageCode, stageId) {

  const dealId = toPositiveInt(id);

  if (!dealId) {
    return { ok: false, error: 'INVALID_DEAL_ID' };
  }

  const normalizedStageId = toPositiveInt(stageId);
  const normalizedStageCode = stageCode ? String(stageCode).trim() : null;

  if (!normalizedStageId && !normalizedStageCode) {
    return { ok: false, error: 'STAGE_REQUIRED' };
  }

  const body = {};

  if (normalizedStageId) {
    body.stage_id = normalizedStageId;
    body.stageId = normalizedStageId;   // compatibilidade backend
  }

  if (normalizedStageCode) {
    body.stage_code = normalizedStageCode;
    body.stageCode = normalizedStageCode; // compatibilidade backend
  }

  console.log('[CRM][API] moveDealToStage payload:', body);

  return fetchJSON(
    apiUrl(API_ROUTES.crm.deals.move(dealId)),
    {
      method: 'PATCH',
      body
    }
  );

}

/* --------------------------------------------------------------------- */
/* STATUS TYPE                                                           */
/* --------------------------------------------------------------------- */

async function apiSetDealStatusType(id, statusTypeId, note = null) {

  const dealId = toPositiveInt(id);
  const stId = toPositiveInt(statusTypeId);

  if (!dealId || !stId) {
    return { ok: false, error: 'INVALID_DATA' };
  }

  return fetchJSON(
    apiUrl(API_ROUTES.crm.deals.setStatusType(dealId)),
    {
      method: 'PATCH',
      body: {
        status_type_id: stId,
        note: note || undefined
      }
    }
  );
}

async function concludeDealStatusType(id, statusTypeId, note = null) {
  return apiSetDealStatusType(id, statusTypeId, note);
}

/* --------------------------------------------------------------------- */
/* OUTCOME                                                               */
/* --------------------------------------------------------------------- */

async function apiRegisterOutcome(id, payload = {}) {

  const dealId = toPositiveInt(id);

  if (!dealId) {
    return { ok: false, error: 'INVALID_DEAL_ID' };
  }

  return fetchJSON(
    apiUrl(API_ROUTES.crm.deals.registerOutcome(dealId)),
    {
      method: 'POST',
      body: payload
    }
  );
}

/* --------------------------------------------------------------------- */
/* CREATE / UPDATE / DELETE                                              */
/* --------------------------------------------------------------------- */

async function apiCreateDeal(payload) {
  return fetchJSON(
    apiUrl(API_ROUTES.crm.deals.create),
    {
      method: 'POST',
      body: payload || {}
    }
  );
}

async function apiUpdateDeal(id, payload) {

  const dealId = toPositiveInt(id);

  if (!dealId) {
    return { ok: false, error: 'INVALID_DEAL_ID' };
  }

  return fetchJSON(
    apiUrl(API_ROUTES.crm.deals.update(dealId)),
    {
      method: 'PATCH',
      body: payload || {}
    }
  );
}

async function apiDeleteDeal(id) {

  const dealId = toPositiveInt(id);

  if (!dealId) {
    return { ok: false, error: 'INVALID_DEAL_ID' };
  }

  return fetchJSON(
    apiUrl(API_ROUTES.crm.deals.delete(dealId)),
    {
      method: 'DELETE'
    }
  );
}