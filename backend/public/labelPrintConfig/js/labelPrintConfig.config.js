// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: labelPrintConfig.config.js                                    ║
// ║ MODULE: Label Print Config — Configuration                          ║
// ║ PRODNEX ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export const API_BASE =
  (typeof window !== 'undefined' && (window.API_BASE || window.apiBase)) || '';

export const ROUTES = Object.freeze({
  base: `${API_BASE}/api/label-print-config`,
  reset: `${API_BASE}/api/label-print-config/reset`,
});

export const DEFAULT_CONFIG = Object.freeze({
  width_mm: 80,
  height_mm: 40,
  margin_mm: 2,
  orientation: 'portrait',
  barcode_height: 40,
  font_size_pt: 8,
  barcode_type: 'CODE128',
  copies: 1,
  paper: 'custom',
  show_label_text: true,
  show_location: true,
  location_font_size: 7,
  show_id: false,
});

export const FIELD_IDS = Object.freeze([
  'width_mm',
  'height_mm',
  'margin_mm',
  'orientation',
  'barcode_height',
  'font_size_pt',
  'barcode_type',
  'copies',
  'paper',
  'show_label_text',
  'show_location',
  'location_font_size',
  'show_id',
]);
