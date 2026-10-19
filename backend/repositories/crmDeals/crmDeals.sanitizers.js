// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmDeals.sanitizers.js — Normalização de ids / outcome type        ║
// ╚════════════════════════════════════════════════════════════════════╝

import { toNumOrNull, toPositiveNumOrNull } from './crmDeals.utils.js';

export function normalizeStatusTypeId(payload = {}) {
  return (
    toNumOrNull(payload.status_type_id) ??
    toNumOrNull(payload.statusTypeId) ??
    toNumOrNull(payload.statusTypeID) ??
    toNumOrNull(payload.tag_status_type_id) ??
    toNumOrNull(payload.tagStatusTypeId) ??
    null
  );
}

export function normalizeLeadSourceId(payload = {}) {
  return (
    toNumOrNull(payload.lead_source_id) ??
    toNumOrNull(payload.leadSourceId) ??
    null
  );
}

export function normalizeOutcomeId(payload = {}) {
  return (
    toPositiveNumOrNull(payload.outcome_id) ??
    toPositiveNumOrNull(payload.outcomeId) ??
    null
  );
}

export function normalizeLossReasonId(payload = {}) {
  return (
    toPositiveNumOrNull(payload.loss_reason_id) ??
    toPositiveNumOrNull(payload.lossReasonId) ??
    null
  );
}

export function normalizeOutcomeType(outcomeType, outcomeId = null) {
  const raw = String(outcomeType || '').trim().toUpperCase();

  if (raw === 'CONVERSION' || raw === 'WON' || raw === 'VENDA') return 'CONVERSION';
  if (raw === 'LOSS' || raw === 'LOST' || raw === 'QUEDA_DE_VENDA') return 'LOSS';
  if (raw === 'NO_SUCCESS_CONTACT' || raw === 'NO_CONTACT' || raw === 'SEM_CONTATO') return 'NO_SUCCESS_CONTACT';

  if (Number(outcomeId) === 1) return 'NO_SUCCESS_CONTACT';
  if (Number(outcomeId) === 2) return 'LOSS';
  if (Number(outcomeId) === 3) return 'CONVERSION';

  return null;
}
