import { VALID_TABS } from './pdvSalesReport.config.js';

export function validateFilters(params) {
  const startDate = params.get('startDate');
  const endDate = params.get('endDate');
  if (startDate && endDate && startDate > endDate) {
    throw new Error('A data inicial não pode ser posterior à data final.');
  }
}

export const isValidTab = (tab) => VALID_TABS.has(tab);
