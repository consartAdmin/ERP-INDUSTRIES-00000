// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: labelPrintConfig.render.js                                    ║
// ║ MODULE: Label Print Config — Rendering                              ║
// ║ PRODNEX ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { readForm } from './labelPrintConfig.form.js';
import { dom, state } from './labelPrintConfig.state.js';
import { getBarcodeMock, mmToPx } from './labelPrintConfig.utils.js';

export function renderPreview() {
  const config = readForm();
  const widthPx = mmToPx(config.width_mm);
  const heightPx = mmToPx(config.height_mm);
  const marginPx = mmToPx(config.margin_mm);

  if (dom.labelPreview) {
    dom.labelPreview.style.width =
      `${Math.min(Math.max(widthPx, 160), 460)}px`;
    dom.labelPreview.style.minHeight =
      `${Math.min(Math.max(heightPx, 90), 280)}px`;
    dom.labelPreview.style.padding = `${Math.max(marginPx, 6)}px`;
    dom.labelPreview.style.aspectRatio =
      config.orientation === 'landscape'
        ? `${Math.max(config.width_mm, config.height_mm)} / ${Math.min(config.width_mm, config.height_mm)}`
        : `${config.width_mm} / ${config.height_mm}`;
  }

  if (dom.previewBarcode) {
    dom.previewBarcode.textContent = getBarcodeMock(config.barcode_type);
    dom.previewBarcode.style.fontSize =
      `${Math.max(config.barcode_height / 2.2, 14)}px`;
  }

  if (dom.previewName) {
    dom.previewName.style.display = config.show_label_text ? 'block' : 'none';
    dom.previewName.style.fontSize = `${config.font_size_pt}px`;
  }

  if (dom.previewLocation) {
    dom.previewLocation.style.display =
      config.show_location ? 'block' : 'none';
    dom.previewLocation.style.fontSize =
      `${config.location_font_size}px`;
  }

  if (dom.previewId) {
    dom.previewId.style.display = config.show_id ? 'block' : 'none';
  }
}

export function setLoading(active) {
  state.loading = Boolean(active);
  dom.loadingOverlay?.classList.toggle('hidden', !state.loading);
  if (dom.btnSave) dom.btnSave.disabled = state.loading;
  if (dom.btnReset) dom.btnReset.disabled = state.loading;
}
