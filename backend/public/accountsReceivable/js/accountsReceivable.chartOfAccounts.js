'use strict';

import { listChartOfAccounts } from './accountsReceivable.api.js';
import { $ } from './accountsReceivable.utils.js';

const SELECTS = [
  { selector: '#arChartAccountId', placeholder: 'Selecione...' },
  { selector: '#receive_chart_account_id', placeholder: '(opcional)' },
];

function rowsFrom(response) {
  if (Array.isArray(response)) return response;
  for (const key of ['rows', 'items', 'data', 'chartOfAccounts']) {
    if (Array.isArray(response?.[key])) return response[key];
  }
  return [];
}

function fillSelect(select, rows, placeholder) {
  if (!select) return;
  const selectedValue = String(select.value || '');
  select.replaceChildren(new Option(placeholder, ''));

  for (const row of rows) {
    if (row?.id == null || !row.code || !row.description) continue;
    select.add(new Option(`${row.code} — ${row.description}`, String(row.id)));
  }

  select.value = selectedValue;
}

export async function initChartOfAccountsSelects() {
  try {
    const rows = rowsFrom(await listChartOfAccounts());
    for (const { selector, placeholder } of SELECTS) {
      fillSelect($(selector), rows, placeholder);
    }
  } catch (error) {
    for (const { selector } of SELECTS) {
      const select = $(selector);
      if (select) select.replaceChildren(new Option('Erro ao carregar plano', ''));
    }
    throw error;
  }
}
