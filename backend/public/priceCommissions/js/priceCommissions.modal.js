// ╔══════════════════════════════════════════════════════════════════════╗
// ║ priceCommissions.modal.js — Controle do modal | PRODNEX ERP         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { dom } from './priceCommissions.config.js';
import { state } from './priceCommissions.state.js';
import { syncCommissionTypeFields } from './priceCommissions.form.js';
import { fillSelect, todayYmd } from './priceCommissions.utils.js';

export function openPriceCommissionModal(editRow = null) {
  dom.modal.setAttribute('aria-hidden', 'false');
  dom.modal.hidden = false;
  dom.modal.classList.add('is-open');

  dom.commission_id.value = editRow?.commission_id ?? '';
  dom.mTitle.textContent = editRow
    ? `Editar Regra #${editRow.commission_id}`
    : 'Nova Regra';

  dom.btnDelete.hidden = !editRow;
  dom.btnDelete.style.display = editRow ? '' : 'none';

  fillSelect(dom.price_id, state.prices, {
    valueKey: 'price_id',
    labelKey: 'name',
    firstLabel: null
  });

  fillSelect(dom.seller_id, state.sellers, {
    valueKey: 'id',
    labelKey: 'name',
    firstLabel: null
  });

  dom.price_id.value = editRow?.price_id ?? state.prices[0]?.price_id ?? '';
  dom.seller_id.value = editRow?.seller_id ?? state.sellers[0]?.id ?? '';
  dom.commission_type.value = editRow?.commission_type ?? 'PERCENT';
  dom.percent_value.value = Number(editRow?.percent_value ?? 0);
  dom.fixed_value.value = Number(editRow?.fixed_value ?? 0);
  dom.active.value = String(editRow?.active ?? true);
  dom.valid_from.value = editRow?.valid_from
    ? String(editRow.valid_from).slice(0, 10)
    : todayYmd();
  dom.valid_to.value = editRow?.valid_to
    ? String(editRow.valid_to).slice(0, 10)
    : '';

  syncCommissionTypeFields();
}

export function closePriceCommissionModal() {
  dom.modal.classList.remove('is-open');
  dom.modal.setAttribute('aria-hidden', 'true');
  dom.modal.hidden = true;
}

