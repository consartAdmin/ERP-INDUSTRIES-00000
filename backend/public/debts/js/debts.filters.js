// js/debts.summary.js
'use strict';

import { els } from './debts.config.js';
import { state } from './debts.state.js';
import { API_BASE, fetchJSON } from './debts.api.js';
import { buildQuery, formatMoney, showToast } from './debts.utils.js';
import { loadDebts } from './debts.render.js';

export function getFilters() {
  return {
    q: els.q?.value.trim() || '',
    status: els.status?.value || '',
    debt_type: els.debt_type?.value || '',
    creditor_name: els.creditor_name?.value.trim() || '',
    due_date_from: els.due_date_from?.value || '',
    due_date_to: els.due_date_to?.value || '',
    only_overdue: Boolean(els.only_overdue?.checked),
    only_open: Boolean(els.only_open?.checked),
    page: state.page,
    limit: state.limit
  };
}

export async function loadSummary() {
  try {
    const filters = getFilters();

    delete filters.page;
    delete filters.limit;

    const qs = buildQuery(filters);
    const data = await fetchJSON(`${API_BASE}/debts/summary?${qs}`);

    const summary = data?.summary || {};

    els.sumTotalOpen.textContent = formatMoney(summary.total_open);
    els.sumTotalOverdue.textContent = formatMoney(summary.total_overdue);
    els.sumDueToday.textContent = formatMoney(summary.due_today);
    els.sumTotalPaid.textContent = formatMoney(summary.total_paid);
  } catch (error) {
    console.error('[debts] loadSummary', error);
    showToast(error.message || 'Erro ao carregar resumo.', 'error');
  }
}

export async function refreshAll() {
  await Promise.all([loadSummary(), loadDebts()]);
}
