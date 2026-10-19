'use strict';

import { buildPdfUrl, fetchSalesReport } from './salesReport.api.js';
import { resetFilters } from './salesReport.filters.js';
import { getFiltersFromDOM, toggleCostMode } from './salesReport.form.js';
import { showMessage } from './salesReport.modal.js';
import {
  renderActiveTable,
  renderReport,
  setLoading,
  updateCostModeUI,
} from './salesReport.render.js';
import { dom, state } from './salesReport.state.js';
import { $, $$ } from './salesReport.utils.js';

export function setupTabs() {
  const container = $('.tabs');
  if (!container) return;

  const buttons = $$('.tab[data-tab]', container);
  const panels = $$('.tab-panel[data-panel]', container);

  const activate = (tabName) => {
    state.activeTab = tabName;
    state.page = 1;
    buttons.forEach((button) => {
      const active = button.dataset.tab === tabName;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });
    panels.forEach((panel) => {
      const active = panel.dataset.panel === tabName;
      panel.classList.toggle('is-active', active);
      panel.hidden = !active;
    });
    renderActiveTable();
  };

  buttons.forEach((button) => button.addEventListener('click', () => activate(button.dataset.tab)));
  activate(buttons.find((button) => button.classList.contains('is-active'))?.dataset.tab || 'day');
}

export async function loadAndRenderSalesReport({ initial = false } = {}) {
  try {
    setLoading(true);
    renderReport(await fetchSalesReport(initial ? {} : getFiltersFromDOM()));
  } catch (error) {
    console.error('[salesReport] Erro ao carregar relatório', error);
    showMessage({
      variant: 'error',
      title: 'Erro ao carregar relatório',
      message: error?.message || 'Verifique o console para mais detalhes.',
    });
  } finally {
    setLoading(false);
  }
}

export function exportCurrentTableToCsv() {
  const activePanel = $('.tab-panel.is-active');
  const table = activePanel?.querySelector('table');
  if (!table) {
    showMessage({ variant: 'info', title: 'Exportar CSV', message: 'Nenhuma tabela disponível para exportação.' });
    return;
  }

  const csv = Array.from(table.querySelectorAll('tr')).map((row) =>
    Array.from(row.querySelectorAll('th, td'))
      .map((cell) => `"${(cell.textContent || '').replace(/"/g, '""').trim()}"`)
      .join(';')
  ).join('\n');

  const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  const suffix = $('.tab.is-active')?.dataset.tab || 'relatorio';
  link.href = url;
  link.download = `salesReport_${suffix}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function openPdf(mode) {
  window.open(buildPdfUrl(getFiltersFromDOM(), mode), '_blank', 'noopener');
}

export function bindActions() {
  dom.btnBack?.addEventListener('click', () => window.history.back());
  dom.btnApply?.addEventListener('click', () => loadAndRenderSalesReport());
  dom.btnReset?.addEventListener('click', async () => {
    resetFilters();
    await loadAndRenderSalesReport({ initial: true });
  });
  dom.btnExportCsv?.addEventListener('click', exportCurrentTableToCsv);
  dom.btnPdfFull?.addEventListener('click', () => openPdf('full'));
  dom.btnPdfProducts?.addEventListener('click', () => openPdf('products'));
  dom.btnPdfOrders?.addEventListener('click', () => openPdf('orders'));
  dom.btnCostMode?.addEventListener('click', async () => {
    toggleCostMode();
    updateCostModeUI();
    await loadAndRenderSalesReport();
  });
  dom.btnPreviousPage?.addEventListener('click', () => {
    if (state.page <= 1) return;
    state.page -= 1;
    renderActiveTable();
  });
  dom.btnNextPage?.addEventListener('click', () => {
    const rows = state.activeTab === 'customer'
      ? state.reportData.byCustomer
      : state.activeTab === 'product'
        ? state.reportData.byProduct
        : state.reportData.byDay;
    const totalPages = Math.max(1, Math.ceil(rows.length / state.pageSize));
    if (state.page >= totalPages) return;
    state.page += 1;
    renderActiveTable();
  });
  dom.rowsPerPage?.addEventListener('change', () => {
    const pageSize = Number(dom.rowsPerPage.value);
    state.pageSize = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 50;
    state.page = 1;
    renderActiveTable();
  });
}
