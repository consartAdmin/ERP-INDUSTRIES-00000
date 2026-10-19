'use strict';

import { openChartAccountsModalSearch } from '/public/modalsSearch/chartAccountsModalSearch.js';
import { $ } from './accountsReceivable.utils.js';

const PICKERS = {
  form: {
    id: '#arChartAccountId',
    search: '#arChartAccountSearch',
  },
  receive: {
    id: '#receive_chart_account_id',
    search: '#receive_chart_account_search',
  },
};

function labelFrom(code, description) {
  return [code ?? '', description ?? ''].filter(Boolean).join(' — ');
}

// Recebe uma conta do plano de contas (public."chartOfAccounts"),
// como a devolvida pelo modal de busca: { id, code, description }.
export function setChartAccountPickerValue(kind, chartAccount = {}) {
  const picker = PICKERS[kind];
  if (!picker) return;

  const idInput = $(picker.id);
  const searchInput = $(picker.search);

  if (idInput) idInput.value = chartAccount.id ?? '';
  if (searchInput) {
    searchInput.value = labelFrom(chartAccount.code, chartAccount.description);
  }
}

// Recebe um título a receber (public."accountsReceivable").
// Aqui `record.id` é o ID do TÍTULO, não do plano de contas — por isso a
// conta contábil precisa vir dos campos chart_account_*.
export function setChartAccountPickerFromRecord(kind, record = {}) {
  setChartAccountPickerValue(kind, {
    id: record.chart_account_id ?? '',
    code: record.chart_account_code,
    description: record.chart_account_description,
  });
}

export function clearChartAccountPicker(kind) {
  setChartAccountPickerValue(kind, {});
}

async function openPicker(kind) {
  const picker = PICKERS[kind];
  const searchInput = $(picker.search);
  const selected = await openChartAccountsModalSearch({
    query: searchInput?.value || '',
    onlyPosting: true,
    onlyActive: true,
  });

  if (selected) setChartAccountPickerValue(kind, selected);
}

export function bindChartAccountPickers() {
  for (const [kind, picker] of Object.entries(PICKERS)) {
    const searchInput = $(picker.search);
    if (!searchInput || searchInput.dataset.chartPickerBound === 'true') continue;

    searchInput.dataset.chartPickerBound = 'true';
    searchInput.addEventListener('click', () => openPicker(kind));
    searchInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      openPicker(kind);
    });
  }
}
