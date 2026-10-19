// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: labelPrintConfig.init.js                                      ║
// ║ MODULE: Label Print Config — Initialization                         ║
// ║ PRODNEX ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  loadConfig,
  resetConfig,
  saveConfig,
} from './labelPrintConfig.actions.js';
import {
  DEFAULT_CONFIG,
  FIELD_IDS,
} from './labelPrintConfig.config.js';
import { fillForm } from './labelPrintConfig.form.js';
import { renderPreview } from './labelPrintConfig.render.js';
import { cacheDom, dom } from './labelPrintConfig.state.js';

function bindEvents() {
  FIELD_IDS.forEach((id) => {
    const element = dom[id];
    if (!element) return;

    element.addEventListener('input', renderPreview);
    element.addEventListener('change', renderPreview);
  });

  dom.btnSave?.addEventListener('click', saveConfig);
  dom.btnReset?.addEventListener('click', resetConfig);
}

async function init() {
  cacheDom();
  bindEvents();
  fillForm(DEFAULT_CONFIG);
  renderPreview();
  await loadConfig();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
