'use strict';

import { COST_MODES } from './salesReport.config.js';
import { getCostMode } from './salesReport.form.js';
import { dom, state } from './salesReport.state.js';
import { appendCell, moneyBR } from './salesReport.utils.js';

function renderEmpty(tbody, colspan) {
  tbody.innerHTML = `<tr><td colspan="${colspan}" class="sr-table-empty">Nenhum registro encontrado.</td></tr>`;
}

export function renderSummary(summary = {}) {
  const orders = Number(summary.orders_count || 0);
  const items = Number(summary.total_items || 0);
  const total = Number(summary.total_amount || 0);
  const cost = Number(summary.total_cost || 0);
  let profit = Number(summary.gross_profit);
  if (!Number.isFinite(profit)) profit = total - cost;

  if (dom.summaryOrders) dom.summaryOrders.textContent = String(orders);
  if (dom.summaryItems) dom.summaryItems.textContent = String(items);
  if (dom.summaryTotal) dom.summaryTotal.textContent = moneyBR(total);
  if (dom.summaryTicket) dom.summaryTicket.textContent = orders ? moneyBR(total / orders) : 'R$ 0,00';
  if (dom.summaryGrossProfit) dom.summaryGrossProfit.textContent = moneyBR(profit);
}

export function renderByDay(rows = []) {
  if (!dom.tbodyDay) return;
  dom.tbodyDay.replaceChildren();
  if (!rows.length) return renderEmpty(dom.tbodyDay, 4);

  rows.forEach((item) => {
    const row = document.createElement('tr');
    appendCell(row, item.day ? new Date(item.day).toLocaleDateString('pt-BR') : '-');
    appendCell(row, Number(item.orders_count || 0));
    appendCell(row, Number(item.total_items || 0));
    appendCell(row, moneyBR(item.total_amount));
    dom.tbodyDay.appendChild(row);
  });
}

export function renderByCustomer(rows = []) {
  if (!dom.tbodyCustomer) return;
  dom.tbodyCustomer.replaceChildren();
  if (!rows.length) return renderEmpty(dom.tbodyCustomer, 4);

  rows.forEach((item) => {
    const row = document.createElement('tr');
    appendCell(row, item.customer_name || '(Sem nome)');
    appendCell(row, item.customer_id ?? '-');
    appendCell(row, Number(item.orders_count || 0));
    appendCell(row, moneyBR(item.total_amount));
    dom.tbodyCustomer.appendChild(row);
  });
}

export function renderByProduct(rows = []) {
  if (!dom.tbodyProduct) return;
  dom.tbodyProduct.replaceChildren();
  if (!rows.length) return renderEmpty(dom.tbodyProduct, 9);

  rows.forEach((item) => {
    const total = Number(item.total_amount || 0);
    const cost = Number(item.total_cost || 0);
    let profit = Number(item.gross_profit);
    if (!Number.isFinite(profit)) profit = total - cost;

    const row = document.createElement('tr');
    [
      item.product_sku || item.product_code || item.product_id || '-',
      item.product_description || '(Sem descrição)',
      item.product_unit || item.unit || '-',
      Number(item.total_items || 0),
      moneyBR(item.avg_unit_price),
      moneyBR(item.avg_unit_cost ?? item.avg_cost_price),
      moneyBR(total),
      moneyBR(cost),
      moneyBR(profit),
    ].forEach((value) => appendCell(row, value));
    dom.tbodyProduct.appendChild(row);
  });
}

function activeRows() {
  if (state.activeTab === 'customer') return state.reportData.byCustomer;
  if (state.activeTab === 'product') return state.reportData.byProduct;
  return state.reportData.byDay;
}

export function renderActiveTable() {
  const rows = activeRows();
  const totalRecords = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / state.pageSize));
  state.page = Math.min(Math.max(1, state.page), totalPages);

  const start = (state.page - 1) * state.pageSize;
  const pageRows = rows.slice(start, start + state.pageSize);

  if (state.activeTab === 'customer') renderByCustomer(pageRows);
  else if (state.activeTab === 'product') renderByProduct(pageRows);
  else renderByDay(pageRows);

  if (dom.tableInfo) {
    dom.tableInfo.textContent = `${totalRecords} ${totalRecords === 1 ? 'registro encontrado' : 'registros encontrados'}`;
  }
  if (dom.pageInfo) dom.pageInfo.textContent = `Página ${state.page} de ${totalPages}`;
  if (dom.btnPreviousPage) dom.btnPreviousPage.disabled = state.page <= 1;
  if (dom.btnNextPage) dom.btnNextPage.disabled = state.page >= totalPages;
}

export function renderReport(data = {}) {
  renderSummary(data.summary || {});
  state.reportData = {
    byDay: Array.isArray(data.byDay) ? data.byDay : [],
    byCustomer: Array.isArray(data.byCustomer) ? data.byCustomer : [],
    byProduct: Array.isArray(data.byProduct) ? data.byProduct : [],
  };
  state.page = 1;
  renderActiveTable();
}

export function updateCostModeUI() {
  const saleDay = getCostMode() === COST_MODES.SALE_DAY;
  const label = saleDay ? 'Dia da Venda' : 'Atual';
  if (dom.btnCostMode) {
    dom.btnCostMode.textContent = `🧾 Custo: ${label}`;
    dom.btnCostMode.setAttribute('aria-pressed', String(saleDay));
  }
  if (dom.averageCostHeader) dom.averageCostHeader.textContent = `Custo méd. unit. (${label})`;
}

export function setLoading(isLoading) {
  state.loading = Boolean(isLoading);
  if (dom.root) dom.root.dataset.loading = String(state.loading);
  if (dom.btnApply) {
    dom.btnApply.disabled = state.loading;
    dom.btnApply.textContent = state.loading ? 'Carregando...' : '🔍 Aplicar filtros';
  }
}
