// ╔══════════════════════════════════════════════════════════════════════╗
// ║ priceCommissions.form.js — Formulário | PRODNEX ERP                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { dom } from './priceCommissions.config.js';

export function syncCommissionTypeFields() {
  const isPercent = dom.commission_type.value === 'PERCENT';

  dom.percent_value.disabled = !isPercent;
  dom.fixed_value.disabled = isPercent;

  if (isPercent) {
    dom.fixed_value.value = '0';
  } else {
    dom.percent_value.value = '0';
  }
}

export function getFormPayload() {
  return {
    price_id: dom.price_id.value ? Number(dom.price_id.value) : null,
    seller_id: dom.seller_id.value ? Number(dom.seller_id.value) : null,
    commission_type: dom.commission_type.value,
    percent_value: Number(dom.percent_value.value || 0),
    fixed_value: Number(dom.fixed_value.value || 0),
    active: dom.active.value === 'true',
    valid_from: dom.valid_from.value,
    valid_to: dom.valid_to.value || null
  };
}

export function getCurrentCommissionId() {
  return dom.commission_id.value
    ? Number(dom.commission_id.value)
    : null;
}

