'use strict';

import { COST_MODE_KEY, COST_MODES } from './salesReport.config.js';
import { dom } from './salesReport.state.js';
import { normalizeIdLike, safeTrim } from './salesReport.utils.js';

export function getCostMode() {
  return safeTrim(localStorage.getItem(COST_MODE_KEY)) === COST_MODES.SALE_DAY
    ? COST_MODES.SALE_DAY
    : COST_MODES.CURRENT;
}

export function setCostMode(mode) {
  const normalized = mode === COST_MODES.SALE_DAY ? COST_MODES.SALE_DAY : COST_MODES.CURRENT;
  localStorage.setItem(COST_MODE_KEY, normalized);
  return normalized;
}

export function toggleCostMode() {
  return setCostMode(getCostMode() === COST_MODES.CURRENT ? COST_MODES.SALE_DAY : COST_MODES.CURRENT);
}

export function getFiltersFromDOM() {
  const selectedRange = dom.dateRange?.value || {};
  let dateStart = safeTrim(selectedRange.startDate) || null;
  let dateEnd = safeTrim(selectedRange.endDate) || null;
  const month = dom.month?.value || '';
  const selectedYear = safeTrim(dom.year?.value);

  // O período digitado tem prioridade. Mês/ano só formam o período quando
  // as duas datas estiverem vazias, evitando filtros diferentes do exibido.
  if (month && !dateStart && !dateEnd) {
    const year = selectedYear || String(new Date().getFullYear());
    if (dom.year && !dom.year.value) dom.year.value = year;

    const paddedMonth = String(month).padStart(2, '0');
    const lastDay = String(new Date(Number(year), Number(month), 0).getDate()).padStart(2, '0');
    dateStart = `${year}-${paddedMonth}-01`;
    dateEnd = `${year}-${paddedMonth}-${lastDay}`;
  }

  return {
    dateStart,
    dateEnd,
    customerId: normalizeIdLike(dom.customer?.value, dom.customer?.dataset.customerId) || null,
    productId: safeTrim(dom.product?.dataset.productCode || dom.product?.value) || null,
    sellerId: safeTrim(dom.seller?.dataset.sellerId) || null,
    costMode: getCostMode(),
  };
}
