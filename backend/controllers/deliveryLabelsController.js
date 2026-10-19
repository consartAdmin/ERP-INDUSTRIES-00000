// ╔══════════════════════════════════════════════════════════════╗
// ║ deliveryLabelsController.js — Controller Etiquetas Entrega  ║
// ║ CONSART ERP | ESM                                           ║
// ╚══════════════════════════════════════════════════════════════╝

import {
  createDeliveryLabel,
  listDeliveryLabels,
  getDeliveryLabelById,
  updateDeliveryLabel,
  deleteDeliveryLabel,
  createFromOrder,
  createFromBudget,
  createFromInvoice,
} from '../repositories/deliveryLabels/deliveryLabels.index.js';

import {
  DEFAULT_LABEL_SETTINGS,
  getLabelSettings,
  saveLabelSettings,
} from '../repositories/deliveryLabelSettings/deliveryLabelSettings.index.js';

import {
  generateDeliveryLabelsPdf,
  generateDeliveryLabelsPreviewPdf,
} from '../generationPdf/generationDeliveryLabelsPdf.js';

import { pdfToPngPages } from '../utils/pdfToPng.js';

export async function create(req, res) {
  try {
    const row = await createDeliveryLabel(req.body);
    res.status(201).json({ ok: true, row });
  } catch (error) {
    console.error('[deliveryLabels.create] error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
}

export async function list(req, res) {
  try {
    const { rows, total, page, limit } = await listDeliveryLabels(req.query);
    res.json({ ok: true, rows, total, page, limit });
  } catch (error) {
    console.error('[deliveryLabels.list] error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
}

export async function getById(req, res) {
  try {
    const row = await getDeliveryLabelById(req.params.id);

    if (!row) {
      return res.status(404).json({ ok: false, error: 'Etiqueta não encontrada.' });
    }

    res.json({ ok: true, row });
  } catch (error) {
    console.error('[deliveryLabels.getById] error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
}

export async function update(req, res) {
  try {
    const row = await updateDeliveryLabel(req.params.id, req.body);

    if (!row) {
      return res.status(404).json({ ok: false, error: 'Etiqueta não encontrada.' });
    }

    res.json({ ok: true, row });
  } catch (error) {
    console.error('[deliveryLabels.update] error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
}

export async function remove(req, res) {
  try {
    const deleted = await deleteDeliveryLabel(req.params.id);
    res.json({ ok: true, deleted });
  } catch (error) {
    console.error('[deliveryLabels.remove] error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
}

export async function importFromOrder(req, res) {
  try {
    const row = await createFromOrder(req.params.orderId);
    res.status(201).json({ ok: true, row });
  } catch (error) {
    console.error('[deliveryLabels.importFromOrder] error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
}

export async function importFromBudget(req, res) {
  try {
    const row = await createFromBudget(req.params.budgetId);
    res.status(201).json({ ok: true, row });
  } catch (error) {
    console.error('[deliveryLabels.importFromBudget] error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
}

export async function importFromInvoice(req, res) {
  try {
    const row = await createFromInvoice(req.params.invoiceId);
    res.status(201).json({ ok: true, row });
  } catch (error) {
    console.error('[deliveryLabels.importFromInvoice] error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
}

export async function printPdf(req, res) {
  try {
    const ids = String(req.query.ids || '')
      .split(',')
      .map((id) => Number(id))
      .filter(Boolean);

    const buffer = await generateDeliveryLabelsPdf(ids);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="etiquetas-entrega.pdf"');
    res.send(buffer);
  } catch (error) {
    console.error('[deliveryLabels.printPdf] error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
}

export async function getSettings(req, res) {
  try {
    const settings = await getLabelSettings();
    res.json({ ok: true, settings, defaults: DEFAULT_LABEL_SETTINGS });
  } catch (error) {
    console.error('[deliveryLabels.getSettings] error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
}

export async function updateSettings(req, res) {
  try {
    const settings = await saveLabelSettings(req.body);
    res.json({ ok: true, settings });
  } catch (error) {
    console.error('[deliveryLabels.updateSettings] error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
}

export async function previewSettings(req, res) {
  try {
    const pdf = await generateDeliveryLabelsPreviewPdf(req.body);
    const pngs = await pdfToPngPages(pdf, { scale: 3 });

    res.json({
      ok: true,
      pages: pngs.map((png) => `data:image/png;base64,${png.toString('base64')}`),
    });
  } catch (error) {
    console.error('[deliveryLabels.previewSettings] error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
}
