// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: customerRegistration.selects.js                               ║
// ║ MODULE: Customer Registration — Selects                             ║
// ║ PRODNEX ERP                                                         ║
// ║ Segment, classification and salesperson select population          ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { fetchOptions } from './customerRegistration.api.js';
import { ROUTES } from './customerRegistration.config.js';

export async function loadSelects() {
  const results = await Promise.allSettled([
    fillSelect('business_segment', ROUTES.segmentos),
    fillSelect('classification', ROUTES.classificacoes),
    fillSelect('customer-seller-select', ROUTES.vendedores),
  ]);

  for (const result of results) {
    if (result.status === 'rejected') {
      console.warn('[customerRegistration.loadSelects]', result.reason);
    }
  }
}

async function fillSelect(id, url) {
  const select = document.getElementById(id);
  if (!select) return;

  const options = await fetchOptions(url);
  select.innerHTML = '<option value="">Selecione…</option>';

  for (const item of options) {
    const value =
      item?.id ??
      item?.nome ??
      item?.descricao ??
      item?.name ??
      '';
    const text =
      item?.nome ??
      item?.descricao ??
      item?.name ??
      String(value);

    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    select.appendChild(option);
  }
}
