// ╔══════════════════════════════════════════════════════════════════════╗
// ║ labelPrintConfigController.js — Controller Label Print Config        ║
// ║ CONSART ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import labelPrintConfigApi from '../repositories/labelPrintConfig/labelPrintConfig.index.js';

export async function getLabelConfig(req, res, next) {
  try {
    const row = await labelPrintConfigApi.getLabelConfig();

    if (!row) {
      return res.status(404).json({ error: 'Label print config not found' });
    }

    return res.json(row);
  } catch (err) {
    console.error('[labelPrintConfigController] getLabelConfig error:', err);
    return next(err);
  }
}

export async function updateLabelConfig(req, res, next) {
  try {
    const payload = { ...req.body };

    const updated = await labelPrintConfigApi.updateLabelConfig(payload);

    if (!updated) {
      return res.status(404).json({ error: 'Label print config not found' });
    }

    return res.json(updated);
  } catch (err) {
    console.error('[labelPrintConfigController] updateLabelConfig error:', err);

    if (err?.message) {
      return res.status(400).json({ error: err.message });
    }

    return next(err);
  }
}

export async function resetLabelConfig(req, res, next) {
  try {
    const reseted = await labelPrintConfigApi.resetLabelConfig();

    if (!reseted) {
      return res.status(404).json({ error: 'Label print config not found' });
    }

    return res.json(reseted);
  } catch (err) {
    console.error('[labelPrintConfigController] resetLabelConfig error:', err);
    return next(err);
  }
}