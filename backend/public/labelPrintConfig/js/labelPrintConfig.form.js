// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: labelPrintConfig.form.js                                      ║
// ║ MODULE: Label Print Config — Form                                   ║
// ║ PRODNEX ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  DEFAULT_CONFIG,
  FIELD_IDS,
} from './labelPrintConfig.config.js';
import { dom } from './labelPrintConfig.state.js';
import { toBoolean, toNumber } from './labelPrintConfig.utils.js';

export function readForm() {
  return {
    width_mm: toNumber(dom.width_mm?.value, DEFAULT_CONFIG.width_mm),
    height_mm: toNumber(dom.height_mm?.value, DEFAULT_CONFIG.height_mm),
    margin_mm: toNumber(dom.margin_mm?.value, DEFAULT_CONFIG.margin_mm),
    orientation: dom.orientation?.value || DEFAULT_CONFIG.orientation,
    barcode_height: toNumber(
      dom.barcode_height?.value,
      DEFAULT_CONFIG.barcode_height
    ),
    font_size_pt: toNumber(
      dom.font_size_pt?.value,
      DEFAULT_CONFIG.font_size_pt
    ),
    barcode_type: dom.barcode_type?.value || DEFAULT_CONFIG.barcode_type,
    copies: toNumber(dom.copies?.value, DEFAULT_CONFIG.copies),
    paper: dom.paper?.value || DEFAULT_CONFIG.paper,
    show_label_text: Boolean(dom.show_label_text?.checked),
    show_location: Boolean(dom.show_location?.checked),
    location_font_size: toNumber(
      dom.location_font_size?.value,
      DEFAULT_CONFIG.location_font_size
    ),
    show_id: Boolean(dom.show_id?.checked),
  };
}

export function fillForm(config = {}) {
  FIELD_IDS.forEach((id) => {
    const element = dom[id];
    if (!element) return;

    const value = config[id];

    if (element.type === 'checkbox') {
      element.checked = Boolean(value);
      return;
    }

    if (value !== undefined && value !== null) {
      element.value = value;
    }
  });
}

export function normalizeConfig(raw = {}) {
  const data = raw?.data && typeof raw.data === 'object' ? raw.data : raw;

  return {
    width_mm: toNumber(data.width_mm, DEFAULT_CONFIG.width_mm),
    height_mm: toNumber(data.height_mm, DEFAULT_CONFIG.height_mm),
    margin_mm: toNumber(data.margin_mm, DEFAULT_CONFIG.margin_mm),
    orientation: String(data.orientation || DEFAULT_CONFIG.orientation),
    barcode_height: toNumber(
      data.barcode_height,
      DEFAULT_CONFIG.barcode_height
    ),
    font_size_pt: toNumber(data.font_size_pt, DEFAULT_CONFIG.font_size_pt),
    barcode_type: String(data.barcode_type || DEFAULT_CONFIG.barcode_type),
    copies: toNumber(data.copies, DEFAULT_CONFIG.copies),
    paper: String(data.paper || DEFAULT_CONFIG.paper),
    show_label_text: toBoolean(
      data.show_label_text,
      DEFAULT_CONFIG.show_label_text
    ),
    show_location: toBoolean(
      data.show_location,
      DEFAULT_CONFIG.show_location
    ),
    location_font_size: toNumber(
      data.location_font_size,
      DEFAULT_CONFIG.location_font_size
    ),
    show_id: toBoolean(data.show_id, DEFAULT_CONFIG.show_id),
  };
}
