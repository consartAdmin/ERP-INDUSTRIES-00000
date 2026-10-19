/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ FILE: customerActivityController.js                                 ║
   ║ MODULE: Customer Activity                                           ║
   ║ DESCRIPTION: Controller do módulo customerActivity                  ║
   ║ CONSART ERP · Express · ESM                                         ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

'use strict';

import {
  listCustomerActivities,
  getCustomerActivityByCustomerId,
  createCustomerActivityIfMissing,
  updateCustomerActivity,
  registerCustomerFollowup,
  recalculateCustomerActivityStatuses,
  getCustomerActivitySummary,
  applyCrmOutcomeToCustomerActivity,
} from '../repositories/customerActivity/customerActivity.index.js';

function toInt(value, fallback = null) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export async function listCustomerActivityController(req, res) {
  try {
    const data = await listCustomerActivities({
      page: req.query.page,
      limit: req.query.limit,
      status: req.query.status,
      search: req.query.search,
      onlyNeedsFollowup: req.query.onlyNeedsFollowup,
    });

    return res.status(200).json(data);
  } catch (error) {
    console.error('[customerActivity][list] error:', error);
    return res.status(500).json({
      error: 'Failed to list customer activity.',
      details: error.message,
    });
  }
}

export async function getCustomerActivityByCustomerIdController(req, res) {
  try {
    const customerId = toInt(req.params.customerId);

    if (!customerId) {
      return res.status(400).json({ error: 'Invalid customerId.' });
    }

    const row = await getCustomerActivityByCustomerId(customerId);

    if (!row) {
      return res.status(404).json({ error: 'Customer activity not found.' });
    }

    return res.status(200).json(row);
  } catch (error) {
    console.error('[customerActivity][getByCustomerId] error:', error);
    return res.status(500).json({
      error: 'Failed to fetch customer activity.',
      details: error.message,
    });
  }
}

export async function ensureCustomerActivityController(req, res) {
  try {
    const customerId = toInt(req.body.customer_id);

    if (!customerId) {
      return res.status(400).json({ error: 'customer_id is required.' });
    }

    const row = await createCustomerActivityIfMissing(customerId);
    return res.status(200).json(row);
  } catch (error) {
    console.error('[customerActivity][ensure] error:', error);
    return res.status(500).json({
      error: 'Failed to ensure customer activity.',
      details: error.message,
    });
  }
}

export async function updateCustomerActivityController(req, res) {
  try {
    const customerId = toInt(req.params.customerId);

    if (!customerId) {
      return res.status(400).json({ error: 'Invalid customerId.' });
    }

    const updated = await updateCustomerActivity(customerId, req.body || {});

    if (!updated) {
      return res.status(404).json({ error: 'Customer activity not found.' });
    }

    return res.status(200).json(updated);
  } catch (error) {
    console.error('[customerActivity][update] error:', error);
    return res.status(500).json({
      error: 'Failed to update customer activity.',
      details: error.message,
    });
  }
}

export async function registerCustomerFollowupController(req, res) {
  try {
    const customerId = toInt(req.params.customerId);

    if (!customerId) {
      return res.status(400).json({ error: 'Invalid customerId.' });
    }

    const {
      followup_type,
      inactivity_reason,
      status,
      crm_deals_outcome_id,
      source_module,
      source_reference_id,
    } = req.body || {};

    if (!followup_type) {
      return res.status(400).json({
        error: 'followup_type is required. Use whatsapp, call or email.',
      });
    }

    const updated = await registerCustomerFollowup(customerId, {
      followup_type,
      inactivity_reason,
      status,
      crm_deals_outcome_id,
      source_module,
      source_reference_id,
    });

    if (!updated) {
      return res.status(404).json({ error: 'Customer activity not found.' });
    }

    return res.status(200).json(updated);
  } catch (error) {
    console.error('[customerActivity][followup] error:', error);

    if (error.message === 'INVALID_FOLLOWUP_TYPE') {
      return res.status(400).json({
        error: 'Invalid followup_type. Allowed: whatsapp, call, email.',
      });
    }

    return res.status(500).json({
      error: 'Failed to register follow-up.',
      details: error.message,
    });
  }
}

export async function recalculateCustomerActivityController(req, res) {
  try {
    const result = await recalculateCustomerActivityStatuses();
    return res.status(200).json({
      message: 'Customer activity recalculated successfully.',
      affectedRows: result.affectedRows,
      rows: result.rows,
    });
  } catch (error) {
    console.error('[customerActivity][recalculate] error:', error);
    return res.status(500).json({
      error: 'Failed to recalculate customer activity.',
      details: error.message,
    });
  }
}

export async function getCustomerActivitySummaryController(req, res) {
  try {
    const rows = await getCustomerActivitySummary();
    return res.status(200).json(rows);
  } catch (error) {
    console.error('[customerActivity][summary] error:', error);
    return res.status(500).json({
      error: 'Failed to fetch customer activity summary.',
      details: error.message,
    });
  }
}

export async function applyCrmOutcomeController(req, res) {
  try {
    const customerId = toInt(req.body.customer_id);
    const outcomeId = toInt(req.body.outcome_id);
    const dealId = toInt(req.body.deal_id);

    if (!customerId || !outcomeId || !dealId) {
      return res.status(400).json({
        error: 'customer_id, outcome_id and deal_id are required.',
      });
    }

    const updated = await applyCrmOutcomeToCustomerActivity({
      customerId,
      outcomeId,
      dealId,
    });

    if (!updated) {
      return res.status(404).json({
        error: 'Customer activity not found after applying CRM outcome.',
      });
    }

    return res.status(200).json(updated);
  } catch (error) {
    console.error('[customerActivity][applyOutcome] error:', error);

    if (error.message === 'OUTCOME_NOT_FOUND') {
      return res.status(404).json({ error: 'Outcome not found.' });
    }

    if (
      error.message === 'INVALID_CUSTOMER_ID' ||
      error.message === 'INVALID_OUTCOME_ID' ||
      error.message === 'INVALID_DEAL_ID'
    ) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(500).json({
      error: 'Failed to apply CRM outcome.',
      details: error.message,
    });
  }
}