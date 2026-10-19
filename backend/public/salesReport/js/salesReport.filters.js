'use strict';

import { dom } from './salesReport.state.js';

export function setupYearSelect({ pastYears = 12, futureYears = 1, defaultToCurrentYear = false } = {}) {
  if (!dom.year || dom.year.dataset.filled === 'true') return;

  const currentYear = new Date().getFullYear();
  const placeholder = dom.year.querySelector('option[value=""]') || new Option('Ano opcional', '');
  dom.year.replaceChildren(placeholder);

  for (let year = currentYear + futureYears; year >= currentYear - pastYears; year -= 1) {
    dom.year.appendChild(new Option(String(year), String(year)));
  }

  if (defaultToCurrentYear) dom.year.value = String(currentYear);
  dom.year.dataset.filled = 'true';
}

export function setupDateRangeFilter() {
  if (!dom.dateRange || dom.dateRange.dataset.bound === 'true') return;

  dom.dateRange.addEventListener('range-change', () => {
    // An explicit date interval takes priority over the month/year shortcut.
    if (dom.month) dom.month.value = '';
    if (dom.year) dom.year.value = '';
  });

  dom.month?.addEventListener('change', () => {
    if (!dom.month.value) return;
    dom.dateRange.value = { startDate: '', endDate: '' };
  });

  dom.dateRange.dataset.bound = 'true';
}

export function resetFilters() {
  if (dom.dateRange) {
    dom.dateRange.value = { startDate: '', endDate: '' };
  }

  [dom.month, dom.year].forEach((element) => {
    if (element) element.value = '';
  });

  const selections = [
    [dom.seller, 'sellerId'],
    [dom.customer, 'customerId'],
    [dom.product, 'productCode'],
  ];

  selections.forEach(([element, dataKey]) => {
    if (!element) return;
    element.value = '';
    delete element.dataset[dataKey];
  });
}
