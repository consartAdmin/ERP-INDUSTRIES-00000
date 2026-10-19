import { elements } from './pdvSalesReport.form.js';
import { getCurrentTab, getReportData } from './pdvSalesReport.state.js';
import { escapeHtml, formatCurrencyBR, formatDateBR } from './pdvSalesReport.utils.js';

const emptyRow = (colspan) => `
  <tr><td colspan="${colspan}" class="sr-table-empty">
    Nenhum dado para exibir com os filtros atuais.
  </td></tr>`;

function renderRows(tbody, rows, colspan, template) {
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!rows.length) {
    tbody.innerHTML = emptyRow(colspan);
    return;
  }
  const fragment = document.createDocumentFragment();
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    tr.innerHTML = template(row);
    fragment.appendChild(tr);
  });
  tbody.appendChild(fragment);
}

export function renderSummary(summary = {}) {
  const values = summary || {};
  if (elements.summaryTotal) elements.summaryTotal.textContent = formatCurrencyBR(values.totalSold);
  if (elements.summaryOrders) elements.summaryOrders.textContent = String(values.orders ?? 0);
  if (elements.summaryItems) elements.summaryItems.textContent = String(values.itemsSold ?? 0);
  if (elements.summaryTicket) elements.summaryTicket.textContent = formatCurrencyBR(values.avgTicket);
  if (elements.summaryGrossProfit) elements.summaryGrossProfit.textContent = formatCurrencyBR(values.grossProfit);
}

function renderDay(data) {
  renderRows(elements.tbodyByDay, data.detailByDay || [], 4, (row) => `
    <td>${formatDateBR(row.date)}</td><td>${row.orders ?? 0}</td>
    <td>${row.items ?? 0}</td><td>${formatCurrencyBR(row.total)}</td>`);
}

function renderCustomer(data) {
  renderRows(elements.tbodyByCustomer, data.detailByCustomer || [], 4, (row) => `
    <td>${escapeHtml(row.customer || 'CONSUMIDOR FINAL')}</td><td>${row.orders ?? 0}</td>
    <td>${row.items ?? 0}</td><td>${formatCurrencyBR(row.total)}</td>`);
}

function renderSale(data) {
  renderRows(elements.tbodyByProduct, data.detailBySale || [], 5, (row) => `
    <td>${formatDateBR(row.date)}</td>
    <td>${escapeHtml(row.couponNumber || row.nfceNumber || row.id || '')}</td>
    <td>${escapeHtml(row.customer || 'CONSUMIDOR FINAL')}</td>
    <td>${row.items ?? 0}</td><td>${formatCurrencyBR(row.total)}</td>`);
}

export function renderActiveTab() {
  const data = getReportData();
  if (!data) return;
  const renderers = { day: renderDay, customer: renderCustomer, product: renderSale };
  (renderers[getCurrentTab()] || renderDay)(data);
}

export function renderTabSelection(tabKey) {
  elements.tabButtons.forEach((button) => {
    const active = button.dataset.tab === tabKey;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
  });
  elements.tabPanels.forEach((panel) => {
    const active = panel.dataset.panel === tabKey ||
      (tabKey === 'product' && panel.dataset.panel === 'sale');
    panel.classList.toggle('is-active', active);
    panel.hidden = !active;
  });
}
