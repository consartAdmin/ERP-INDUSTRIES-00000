// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: labelPrintConfig.state.js                                     ║
// ║ MODULE: Label Print Config — State and DOM                          ║
// ║ PRODNEX ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { FIELD_IDS } from './labelPrintConfig.config.js';

export const dom = {};

export const state = {
  loading: false,
};

export function cacheDom() {
  FIELD_IDS.forEach((id) => {
    dom[id] = document.getElementById(id);
  });

  dom.btnSave = document.getElementById('btnSave');
  dom.btnReset = document.getElementById('btnReset');
  dom.loadingOverlay = document.getElementById('loadingOverlay');
  dom.labelPreview = document.getElementById('labelPreview');
  dom.previewBarcode = document.getElementById('previewBarcode');
  dom.previewName = document.getElementById('previewName');
  dom.previewLocation = document.getElementById('previewLocation');
  dom.previewId = document.getElementById('previewId');
}
