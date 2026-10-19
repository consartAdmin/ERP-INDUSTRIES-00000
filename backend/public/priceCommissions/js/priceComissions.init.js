// ╔══════════════════════════════════════════════════════════════════════╗
// ║ priceComissions.init.js — Inicialização do módulo | PRODNEX ERP     ║
// ║ NOTE: Nome mantido conforme padrão solicitado pelo projeto          ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  assertRequiredDom,
  refreshDom
} from './priceCommissions.config.js';
import {
  loadPriceCommissionCombos,
  searchPriceCommissions
} from './priceCommissions.actions.js';
import { bindPriceCommissionEvents } from './priceCommissions.events.js';
import { state } from './priceCommissions.state.js';
import { showToast } from './priceCommissions.utils.js';

async function initPriceCommissions() {
  if (state.initialized) return;

  try {
    refreshDom();
    assertRequiredDom();
    bindPriceCommissionEvents();

    await loadPriceCommissionCombos();
    await searchPriceCommissions();

    state.initialized = true;
  } catch (error) {
    console.error('[priceCommissions] init', error);
    showToast(error.message || 'Erro ao iniciar o módulo de comissões.');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPriceCommissions, {
    once: true
  });
} else {
  initPriceCommissions();
}

export { initPriceCommissions };

