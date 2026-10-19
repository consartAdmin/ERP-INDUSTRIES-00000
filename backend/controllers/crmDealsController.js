// ╔══════════════════════════════════════════════════════════════════════╗
// ║ crmDealsController.js — Controller CRM Deals                        ║
// ║ CONSART ERP | ESM                                                   ║
// ║ ✅ Kanban / Deals / Outcomes / Status Sync                          ║
// ║ ✅ Conclusão do Lead: fecha card + contabiliza no summary           ║
// ║ ✅ Escopo por usuário via sellerByUser (sellerIds[])                ║
// ║ ✅ Catálogos: Lead Sources + Deal Outcomes                          ║
// ╚══════════════════════════════════════════════════════════════════════╝

import crmDealsApi from '../repositories/crmDeals/crmDeals.index.js';
import sellerByUserApi from '../repositories/sellerByUser/sellerByUser.index.js';
import { normalizeCrmCompany } from '../repositories/crmDeals/crmDeals.utils.js';

function sendError(res, statusCode = 500, error = 'UNKNOWN_ERROR') {
  return res.status(statusCode).json({ ok: false, error });
}

function getUserId(req) {
  const raw =
    req.user?.user_id ??
    req.user?.id ??
    req.session?.userId ??
    req.userId ??
    null;

  const id = Number(raw);

  return Number.isFinite(id) && id > 0
    ? id
    : null;
}

// Qual CRM a tela está usando: 'BH3' (Gestão de Vendas) ou 'CONSART' (CRM Consart ERP).
// A tela envia o header X-CRM-Company; sem header = BH3 (comportamento antigo).
function getCrmCompany(req) {
  return normalizeCrmCompany(req.get('x-crm-company') || req.query.crmCompany);
}

function isAdmin(req) {
  const user = req.user || {};

  const accessLevel = String(
    user.access_level ??
    user.accessLevel ??
    ''
  )
    .trim()
    .toLowerCase();

  return accessLevel === 'admin';
}

async function getSellerScope(req) {
  if (isAdmin(req)) {
    return { ok: true, is_admin: true, sellerIds: null, primarySellerId: null };
  }

  const userId = getUserId(req);
  if (!userId) {
    return { ok: false, error: 'UNAUTHORIZED' };
  }

  const links = await sellerByUserApi.getByUserId(userId, { include_inactive: false });
  const sellerIds = (links || [])
    .map((r) => Number(r.seller_id))
    .filter((n) => Number.isFinite(n) && n > 0);

  const primary = (links || []).find((r) => r.is_primary) || (links || [])[0] || null;
  const primarySellerId = primary?.seller_id ? Number(primary.seller_id) : null;

  return {
    ok: true,
    is_admin: false,
    sellerIds: sellerIds.length ? Array.from(new Set(sellerIds)) : [],
    primarySellerId,
  };
}

function pickAllowedSellerId({ payloadSellerId, sellerIds, primarySellerId }) {
  const p = payloadSellerId ? Number(payloadSellerId) : null;

  if (!p) return primarySellerId || (sellerIds?.[0] || null);
  if (sellerIds?.length && sellerIds.includes(p)) return p;

  return primarySellerId || (sellerIds?.[0] || null);
}

function normalizeStatusTypeFromPayload(payload = {}) {
  const raw =
    payload.status_type_id ??
    payload.statusTypeId ??
    payload.tag_status_id ??
    payload.tagStatusId ??
    payload.customer_status_type_id ??
    payload.customerStatusTypeId ??
    null;

  if (raw === null || raw === undefined || raw === '') return null;

  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function normalizeLeadSourceFromPayload(payload = {}) {
  const raw = payload.lead_source_id ?? payload.leadSourceId ?? null;
  if (raw === null || raw === undefined || raw === '') return null;

  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function normalizeOutcomeIdFromPayload(payload = {}) {
  const raw = payload.outcome_id ?? payload.outcomeId ?? null;
  if (raw === null || raw === undefined || raw === '') return null;

  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function normalizeLossReasonIdFromPayload(payload = {}) {
  const raw = payload.loss_reason_id ?? payload.lossReasonId ?? null;
  if (raw === null || raw === undefined || raw === '') return null;

  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/* =========================================================================
 * STAGES
 * ========================================================================= */
async function listStages(req, res) {
  try {
    const includeInactive = String(req.query.includeInactive || 'false').toLowerCase() === 'true';

    const { ok, data, error } = await crmDealsApi.listStages({ includeInactive });
    if (!ok) return sendError(res, 500, error || 'STAGES_LIST_ERROR');

    return res.json({ ok: true, data });
  } catch (err) {
    console.error('[crmDealsController.listStages]', err);
    return sendError(res, 500, 'STAGES_LIST_EXCEPTION');
  }
}

/* =========================================================================
 * STATUS TYPES
 * ========================================================================= */
async function listStatusTypes(req, res) {
  try {
    const includeInactive = String(req.query.includeInactive || 'false').toLowerCase() === 'true';

    const { ok, data, error } = await crmDealsApi.listStatusTypes({
      includeInactive: !!includeInactive,
      active: !includeInactive,
    });

    if (!ok) return sendError(res, 500, error || 'STATUS_TYPES_LIST_ERROR');
    return res.json({ ok: true, data });
  } catch (err) {
    console.error('[crmDealsController.listStatusTypes]', err);
    return sendError(res, 500, 'STATUS_TYPES_LIST_EXCEPTION');
  }
}

/* =========================================================================
 * LEAD SOURCES
 * ========================================================================= */
async function listLeadSources(req, res) {
  try {
    const includeInactive = String(req.query.includeInactive || 'false').toLowerCase() === 'true';

    const { ok, data, error } = await crmDealsApi.listLeadSources({
      active: !includeInactive,
    });

    if (!ok) return sendError(res, 500, error || 'LEAD_SOURCES_LIST_ERROR');
    return res.json({ ok: true, data });
  } catch (err) {
    console.error('[crmDealsController.listLeadSources]', err);
    return sendError(res, 500, 'LEAD_SOURCES_LIST_EXCEPTION');
  }
}

/* =========================================================================
 * DEAL OUTCOMES CATALOG
 * ========================================================================= */
async function listDealOutcomes(req, res) {
  try {
    const includeInactive = String(req.query.includeInactive || 'false').toLowerCase() === 'true';

    const { ok, data, error } = await crmDealsApi.listDealOutcomes({
      active: !includeInactive,
    });

    if (!ok) return sendError(res, 500, error || 'DEAL_OUTCOMES_LIST_ERROR');
    return res.json({ ok: true, data });
  } catch (err) {
    console.error('[crmDealsController.listDealOutcomes]', err);
    return sendError(res, 500, 'DEAL_OUTCOMES_LIST_EXCEPTION');
  }
}

/* =========================================================================
 * DEALS
 * ========================================================================= */
async function listDeals(req, res) {
  try {
    const { stageCode, stageId, sellerId, search, state, city, segmentId, limit, offset } = req.query;

    const parsedLimit = limit ? Number(limit) : 50;
    const parsedOffset = offset ? Number(offset) : 0;

    const scope = await getSellerScope(req);
    if (!scope.ok) return sendError(res, 401, scope.error || 'UNAUTHORIZED');

    const sellerIds = scope.is_admin ? null : scope.sellerIds;

    const { ok, data, error } = await crmDealsApi.listDeals({
      company: getCrmCompany(req),
      stageCode: stageCode || undefined,
      stageId: stageId ? Number(stageId) : undefined,
      sellerId: scope.is_admin ? (sellerId ? Number(sellerId) : undefined) : undefined,
      sellerIds: sellerIds?.length ? sellerIds : undefined,
      search: search || undefined,
      state: state || undefined,
      city: city || undefined,
      segmentId: segmentId ? Number(segmentId) : undefined,
      limit: Number.isNaN(parsedLimit) ? 50 : parsedLimit,
      offset: Number.isNaN(parsedOffset) ? 0 : parsedOffset,
    });

    if (!ok) return sendError(res, 500, error || 'DEALS_LIST_ERROR');
    return res.json({ ok: true, data });
  } catch (err) {
    console.error('[crmDealsController.listDeals]', err);
    return sendError(res, 500, 'DEALS_LIST_EXCEPTION');
  }
}

async function listCustomerLocations(_req, res) {
  try {
    const { ok, data, error } = await crmDealsApi.listCustomerLocations();
    if (!ok) return sendError(res, 500, error || 'CUSTOMER_LOCATIONS_ERROR');
    return res.json({ ok: true, data });
  } catch (err) {
    console.error('[crmDealsController.listCustomerLocations]', err);
    return sendError(res, 500, 'CUSTOMER_LOCATIONS_EXCEPTION');
  }
}

async function getDeal(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return sendError(res, 400, 'INVALID_ID');

    const { ok, data, error } = await crmDealsApi.getDealById(id);

    if (!ok) {
      if (error === 'DEAL_NOT_FOUND') return sendError(res, 404, error);
      return sendError(res, 500, error || 'DEAL_GET_ERROR');
    }

    return res.json({ ok: true, data });
  } catch (err) {
    console.error('[crmDealsController.getDeal]', err);
    return sendError(res, 500, 'DEAL_GET_EXCEPTION');
  }
}

async function createDeal(req, res) {
  try {
    const payload = { ...(req.body || {}) };

    const statusTypeId = normalizeStatusTypeFromPayload(payload);
    if (statusTypeId !== null) payload.status_type_id = statusTypeId;

    const leadSourceId = normalizeLeadSourceFromPayload(payload);
    if (leadSourceId !== null) payload.lead_source_id = leadSourceId;

    const outcomeId = normalizeOutcomeIdFromPayload(payload);
    if (outcomeId !== null) payload.outcome_id = outcomeId;

    const lossReasonId = normalizeLossReasonIdFromPayload(payload);
    if (lossReasonId !== null) payload.loss_reason_id = lossReasonId;

    payload.crm_company = getCrmCompany(req);

    const scope = await getSellerScope(req);
    if (!scope.ok) return sendError(res, 401, scope.error || 'UNAUTHORIZED');

    if (!scope.is_admin) {
      const allowedSellerId = pickAllowedSellerId({
        payloadSellerId: payload.seller_id,
        sellerIds: scope.sellerIds,
        primarySellerId: scope.primarySellerId,
      });

      payload.seller_id = allowedSellerId;
      payload.updated_by = getUserId(req);
      payload.updatedBy = getUserId(req);
    }

    const { ok, data, error } = await crmDealsApi.createDeal(payload);

    if (!ok) {
      if (error === 'STAGE_REQUIRED') return sendError(res, 400, error);
      return sendError(res, 500, error || 'DEAL_CREATE_ERROR');
    }

    return res.status(201).json({ ok: true, data });
  } catch (err) {
    console.error('[crmDealsController.createDeal]', err);
    return sendError(res, 500, 'DEAL_CREATE_EXCEPTION');
  }
}

async function updateDeal(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return sendError(res, 400, 'INVALID_ID');

    const payload = { ...(req.body || {}) };

    const statusTypeId = normalizeStatusTypeFromPayload(payload);
    if (statusTypeId !== null) payload.status_type_id = statusTypeId;

    const leadSourceId = normalizeLeadSourceFromPayload(payload);
    if (leadSourceId !== null) payload.lead_source_id = leadSourceId;

    const outcomeId = normalizeOutcomeIdFromPayload(payload);
    if (outcomeId !== null) payload.outcome_id = outcomeId;

    const lossReasonId = normalizeLossReasonIdFromPayload(payload);
    if (lossReasonId !== null) payload.loss_reason_id = lossReasonId;

    const scope = await getSellerScope(req);
    if (!scope.ok) return sendError(res, 401, scope.error || 'UNAUTHORIZED');

    if (!scope.is_admin) {
      const allowedSellerId = pickAllowedSellerId({
        payloadSellerId: payload.seller_id,
        sellerIds: scope.sellerIds,
        primarySellerId: scope.primarySellerId,
      });

      payload.seller_id = allowedSellerId;
      payload.updated_by = getUserId(req);
      payload.updatedBy = getUserId(req);
    }

    const { ok, data, error } = await crmDealsApi.updateDeal(id, payload);

    if (!ok) {
      if (error === 'DEAL_NOT_FOUND') return sendError(res, 404, error);
      return sendError(res, 500, error || 'DEAL_UPDATE_ERROR');
    }

    return res.json({ ok: true, data });
  } catch (err) {
    console.error('[crmDealsController.updateDeal]', err);
    return sendError(res, 500, 'DEAL_UPDATE_EXCEPTION');
  }
}

async function moveDeal(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return sendError(res, 400, 'INVALID_ID');

    const { stageCode, stageId } = req.body || {};

    const { ok, data, error } = await crmDealsApi.moveDealToStage({
      id,
      stageCode: stageCode || undefined,
      stageId: stageId ? Number(stageId) : undefined,
    });

    if (!ok) {
      if (error === 'DEAL_NOT_FOUND') return sendError(res, 404, error);
      if (error === 'STAGE_NOT_FOUND' || error === 'STAGE_REQUIRED') return sendError(res, 400, error);
      return sendError(res, 500, error || 'DEAL_MOVE_ERROR');
    }

    return res.json({ ok: true, data });
  } catch (err) {
    console.error('[crmDealsController.moveDeal]', err);
    return sendError(res, 500, 'DEAL_MOVE_EXCEPTION');
  }
}

async function deleteDeal(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return sendError(res, 400, 'INVALID_ID');

    const { ok, data, error } = await crmDealsApi.deleteDeal(id);

    if (!ok) {
      if (error === 'DEAL_NOT_FOUND') return sendError(res, 404, error);
      return sendError(res, 500, error || 'DEAL_DELETE_ERROR');
    }

    return res.json({ ok: true, data });
  } catch (err) {
    console.error('[crmDealsController.deleteDeal]', err);
    return sendError(res, 500, 'DEAL_DELETE_EXCEPTION');
  }
}

/* =========================================================================
 * CONCLUSÃO DO LEAD (STATUS TYPE)
 * ========================================================================= */
async function setDealStatusType(req, res) {
  try {
    const dealId = Number(req.params.id);
    if (!Number.isFinite(dealId)) return sendError(res, 400, 'INVALID_ID');

    const raw = req.body?.status_type_id ?? req.body?.statusTypeId ?? null;
    const statusTypeId = raw === null ? null : Number(raw);

    if (!Number.isFinite(statusTypeId)) return sendError(res, 400, 'INVALID_STATUS_TYPE_ID');

    const note = req.body?.note ?? req.body?.notes ?? null;
    const userId = getUserId(req);

    const { ok, data, error } = await crmDealsApi.concludeLeadStatusType({
      dealId,
      statusTypeId,
      note,
      userId,
    });

    if (!ok) {
      if (error === 'DEAL_NOT_FOUND') return sendError(res, 404, error);
      if (error === 'STATUS_TYPE_NOT_FOUND' || error === 'INVALID_STATUS_TYPE_ID') {
        return sendError(res, 400, error);
      }
      return sendError(res, 500, error || 'CONCLUDE_LEAD_ERROR');
    }

    return res.json({ ok: true, data });
  } catch (err) {
    console.error('[crmDealsController.setDealStatusType]', err);
    return sendError(res, 500, 'CONCLUDE_LEAD_EXCEPTION');
  }
}

/* =========================================================================
 * SUMMARY DO TOPO (cards fechados)
 * ========================================================================= */
async function leadConclusionSummary(req, res) {
  try {
    const sellerIdQuery = req.query.sellerId ? Number(req.query.sellerId) : undefined;

    const scope = await getSellerScope(req);
    if (!scope.ok) return sendError(res, 401, scope.error || 'UNAUTHORIZED');

    const { ok, data, error } = await crmDealsApi.getLeadConclusionSummary({
      company: getCrmCompany(req),
      sellerId: scope.is_admin ? (Number.isFinite(sellerIdQuery) ? sellerIdQuery : undefined) : undefined,
      sellerIds: scope.is_admin ? undefined : (scope.sellerIds?.length ? scope.sellerIds : undefined),
    });

    if (!ok) return sendError(res, 500, error || 'LEAD_CONCLUSION_SUMMARY_ERROR');
    return res.json({ ok: true, data });
  } catch (err) {
    console.error('[crmDealsController.leadConclusionSummary]', err);
    return sendError(res, 500, 'LEAD_CONCLUSION_SUMMARY_EXCEPTION');
  }
}

/* =========================================================================
 * OUTCOMES
 * ========================================================================= */
async function registerOutcome(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return sendError(res, 400, 'INVALID_ID');

    const body = req.body || {};
    const typeRaw = body.outcome_type || body.outcomeType || body.outcome || '';
    const outcomeId =
      body.outcome_id ?? body.outcomeId ?? null;

    const lossReasonId =
      body.loss_reason_id ?? body.lossReasonId ?? null;

    const note = body.note || body.notes || null;
    const reason = body.reason || body.outcome_reason || null;
    const userId = getUserId(req);

    const { ok, data, error } = await crmDealsApi.registerOutcome({
      dealId: id,
      outcomeType: typeRaw,
      outcomeId,
      note,
      reason,
      userId,
      lossReasonId,
    });

    if (!ok) {
      if (error === 'DEAL_NOT_FOUND') return sendError(res, 404, error);
      if (error === 'INVALID_OUTCOME_TYPE') return sendError(res, 400, error);
      return sendError(res, 500, error || 'DEAL_OUTCOME_ERROR');
    }

    return res.json({ ok: true, data });
  } catch (err) {
    console.error('[crmDealsController.registerOutcome]', err);
    return sendError(res, 500, 'DEAL_OUTCOME_EXCEPTION');
  }
}

async function summaryOutcomes(req, res) {
  try {
    const sellerIdQuery = req.query.sellerId ? Number(req.query.sellerId) : undefined;

    const scope = await getSellerScope(req);
    if (!scope.ok) return sendError(res, 401, scope.error || 'UNAUTHORIZED');

    const { ok, data, error } = await crmDealsApi.getOutcomesSummary({
      company: getCrmCompany(req),
      sellerId: scope.is_admin ? (Number.isFinite(sellerIdQuery) ? sellerIdQuery : undefined) : undefined,
      sellerIds: scope.is_admin ? undefined : (scope.sellerIds?.length ? scope.sellerIds : undefined),
    });

    if (!ok) return sendError(res, 500, error || 'OUTCOMES_SUMMARY_ERROR');
    return res.json({ ok: true, data });
  } catch (err) {
    console.error('[crmDealsController.summaryOutcomes]', err);
    return sendError(res, 500, 'OUTCOMES_SUMMARY_EXCEPTION');
  }
}

async function listOutcomes(req, res) {
  try {
    const outcomeRaw = String(req.query.outcome || '').trim();
    if (!outcomeRaw) return sendError(res, 400, 'OUTCOME_REQUIRED');

    const sellerIdQuery = req.query.sellerId ? Number(req.query.sellerId) : undefined;

    const scope = await getSellerScope(req);
    if (!scope.ok) return sendError(res, 401, scope.error || 'UNAUTHORIZED');

    const { ok, data, error } = await crmDealsApi.listOutcomes({
      company: getCrmCompany(req),
      outcomeType: outcomeRaw,
      sellerId: scope.is_admin ? (Number.isFinite(sellerIdQuery) ? sellerIdQuery : undefined) : undefined,
      sellerIds: scope.is_admin ? undefined : (scope.sellerIds?.length ? scope.sellerIds : undefined),
      search: req.query.search || undefined,
      limit: req.query.limit ? Number(req.query.limit) : 200,
      offset: req.query.offset ? Number(req.query.offset) : 0,
    });

    if (!ok) return sendError(res, 500, error || 'OUTCOMES_LIST_ERROR');
    return res.json({ ok: true, data });
  } catch (err) {
    console.error('[crmDealsController.listOutcomes]', err);
    return sendError(res, 500, 'OUTCOMES_LIST_EXCEPTION');
  }
}

const crmDealsController = {
  listStages,
  listStatusTypes,
  listLeadSources,
  listDealOutcomes,

  listDeals,
  listCustomerLocations,
  getDeal,
  createDeal,
  updateDeal,
  moveDeal,
  deleteDeal,

  setDealStatusType,
  leadConclusionSummary,

  registerOutcome,
  summaryOutcomes,
  listOutcomes,
};

export default crmDealsController;