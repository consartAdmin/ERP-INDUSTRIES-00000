// ╔══════════════════════════════════════════════════════════════════════╗
// ║ labelParametersController.js — Controller (ESM)                     ║
// ║ CONSART ERP — REST handlers for visual label layout parameters      ║
// ║ UPDATE: simplified model + layout_json support                      ║
// ╚══════════════════════════════════════════════════════════════════════╝

import labelParametersApi from '../repositories/labelParameters/labelParameters.index.js';

/**
 * GET /api/label-parameters
 * Optional query: ?userId=1&active=true
 */
export async function listLabelParameters(req, res, next) {
  try {
    const { userId, active } = req.query;

    const filters = {
      userId: userId !== undefined && userId !== '' ? Number(userId) : null,
      active:
        active !== undefined && active !== ''
          ? active === 'true' || active === true
          : null,
    };

    const rows = await labelParametersApi.listLabelParameters(filters);
    return res.json(rows);
  } catch (err) {
    console.error('[labelParametersController] listLabelParameters error:', err);
    return next(err);
  }
}

/**
 * GET /api/label-parameters/:id
 */
export async function getLabelParametersById(req, res, next) {
  try {
    const id = Number(req.params.id);

    if (!id || Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID parameter' });
    }

    const row = await labelParametersApi.getLabelParametersById(id);

    if (!row) {
      return res.status(404).json({ error: 'Label parameters not found' });
    }

    return res.json(row);
  } catch (err) {
    console.error('[labelParametersController] getLabelParametersById error:', err);
    return next(err);
  }
}

/**
 * POST /api/label-parameters
 */
export async function createLabelParameters(req, res, next) {
  try {
    const payload = { ...req.body };

    const created = await labelParametersApi.createLabelParameters(payload);
    return res.status(201).json(created);
  } catch (err) {
    console.error('[labelParametersController] createLabelParameters error:', err);

    if (err?.message) {
      return res.status(400).json({ error: err.message });
    }

    return next(err);
  }
}

/**
 * PUT /api/label-parameters/:id
 */
export async function updateLabelParameters(req, res, next) {
  try {
    const id = Number(req.params.id);

    if (!id || Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID parameter' });
    }

    const payload = { ...req.body };
    delete payload.id;

    const updated = await labelParametersApi.updateLabelParameters(id, payload);

    if (!updated) {
      return res.status(404).json({ error: 'Label parameters not found' });
    }

    return res.json(updated);
  } catch (err) {
    console.error('[labelParametersController] updateLabelParameters error:', err);

    if (err?.message) {
      return res.status(400).json({ error: err.message });
    }

    return next(err);
  }
}

/**
 * DELETE /api/label-parameters/:id
 */
export async function deleteLabelParameters(req, res, next) {
  try {
    const id = Number(req.params.id);

    if (!id || Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID parameter' });
    }

    const deleted = await labelParametersApi.deleteLabelParameters(id);

    if (!deleted) {
      return res.status(404).json({ error: 'Label parameters not found' });
    }

    return res.json({ success: true, deleted });
  } catch (err) {
    console.error('[labelParametersController] deleteLabelParameters error:', err);
    return next(err);
  }
}

/**
 * GET /api/label-parameters/prices
 */
export async function listPriceTables(req, res, next) {
  try {
    const rows = await labelParametersApi.listPriceTables();
    return res.json(rows);
  } catch (err) {
    console.error('[labelParametersController] listPriceTables error:', err);
    return next(err);
  }
}