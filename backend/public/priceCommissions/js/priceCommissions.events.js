// ╔══════════════════════════════════════════════════════════════════════╗
// ║ priceCommissions.events.js — Eventos do módulo | PRODNEX ERP        ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { dom } from './priceCommissions.config.js';
import {
  clearAndSearchPriceCommissions,
  duplicatePriceCommission,
  editPriceCommission,
  removeCurrentPriceCommission,
  savePriceCommission,
  searchPriceCommissions
} from './priceCommissions.actions.js';
import { syncCommissionTypeFields } from './priceCommissions.form.js';
import {
  closePriceCommissionModal,
  openPriceCommissionModal
} from './priceCommissions.modal.js';
import { showToast } from './priceCommissions.utils.js';

let eventsBound = false;

function runAsync(action) {
  Promise.resolve()
    .then(action)
    .catch((error) => {
      console.error('[priceCommissions]', error);
      showToast(error.message || 'Não foi possível concluir a operação.');
    });
}

export function bindPriceCommissionEvents() {
  if (eventsBound) return;
  eventsBound = true;

  dom.btnSearch.addEventListener('click', () => {
    runAsync(searchPriceCommissions);
  });

  dom.btnClear.addEventListener('click', () => {
    runAsync(clearAndSearchPriceCommissions);
  });

  dom.btnClose.addEventListener('click', closePriceCommissionModal);
  dom.btnCancel.addEventListener('click', closePriceCommissionModal);

  dom.modal.addEventListener('click', (event) => {
    if (event.target?.dataset?.close) {
      closePriceCommissionModal();
    }
  });

  dom.commission_type.addEventListener('change', syncCommissionTypeFields);

  dom.form.addEventListener('submit', (event) => {
    runAsync(() => savePriceCommission(event));
  });

  dom.btnDelete.addEventListener('click', () => {
    runAsync(removeCurrentPriceCommission);
  });

  dom.tbody.addEventListener('click', (event) => {
    const button = event.target?.closest('button');
    if (!button) return;

    if (button.dataset.edit) {
      editPriceCommission(Number(button.dataset.edit));
      return;
    }

    if (button.dataset.dup) {
      duplicatePriceCommission(Number(button.dataset.dup));
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && dom.modal.getAttribute('aria-hidden') === 'false') {
      closePriceCommissionModal();
    }
  });
}

