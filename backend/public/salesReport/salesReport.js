// ╔══════════════════════════════════════════════════════════════════════╗
// ║ 📊 salesReport.js – UI Relatório de Vendas (PRODNEX ERP | ESM)      ║
// ║ - Consome GET /api/reports/sales (JSON)                             ║
// ║ - Gera PDF em /api/reports/sales/pdf com os mesmos filtros          ║
// ║ - ✅ sellerId via sellersModalSearch                                ║
// ║ - ✅ Ano é <select> preenchido via JS                               ║
// ║ - ✅ costMode (Custo Atual / Dia da Venda) com botão toggle         ║
// ║ - ✅ Label dinâmico da coluna de custo (Atual vs Dia da Venda)      ║
// ║ - ✅ CSV com BOM (abre perfeito no Excel)                           ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { openProductsModalSearch } from '/public/modalsSearch/productsModalSearch.js';
import { openCustomersModalSearch } from '/public/modalsSearch/customersModalSearch.js';
import { openSellersModalSearch } from '/public/modalsSearch/sellersModalSearch.js';

let showCenterModal = null;
try {
  const mod = await import('/public/includes/js/centerAlertModal.js');
  showCenterModal = mod.showCenterModal || null;
} catch (e) {
  console.warn('[salesReport] centerAlertModal não disponível, usando alert padrão.');
}

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const moneyBR = (value) => {
  const n = Number(value || 0);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

function showMessage({ variant = 'info', title = 'Info', message = '' }) {
  if (showCenterModal) {
    showCenterModal({ variant, title, message, timeoutMs: 4500 });
  } else {
    alert(`${title}\n\n${message}`);
  }
}

function safeTrim(v) {
  return String(v ?? '').trim();
}

function normalizeIdLike(inputValue, datasetValue) {
  const fromDataset = safeTrim(datasetValue);
  if (fromDataset) return fromDataset;

  const raw = safeTrim(inputValue);
  if (!raw) return '';

  const m = raw.match(/^(\d+)\s*[-–]/);
  if (m && m[1]) return m[1];

  return raw;
}

// =========================================================
// ✅ COST MODE (toggle)
// =========================================================
const COST_MODE_KEY = 'salesReport.costMode';
const COST_MODES = Object.freeze({
  current: { value: 'current', label: 'Atual' },
  saleDay: { value: 'saleDay', label: 'Dia da Venda' },
});

function getCostMode() {
  const saved = safeTrim(localStorage.getItem(COST_MODE_KEY));
  return saved === 'saleDay' ? 'saleDay' : 'current';
}

function setCostMode(mode) {
  const v = mode === 'saleDay' ? 'saleDay' : 'current';
  localStorage.setItem(COST_MODE_KEY, v);
  updateCostModeButton();
  updateCostModeLabels();
}

function toggleCostMode() {
  const cur = getCostMode();
  setCostMode(cur === 'current' ? 'saleDay' : 'current');
}

function updateCostModeButton() {
  const btn = $('#btn-cost-mode');
  if (!btn) return;

  const mode = getCostMode();
  const label = mode === 'saleDay' ? 'Dia da Venda' : 'Atual';

  btn.textContent = `🧾 Custo: ${label}`;
  btn.setAttribute('aria-pressed', mode === 'saleDay' ? 'true' : 'false');
}

/**
 * ✅ Atualiza labels/títulos da UI dependendo do modo de custo.
 * Para funcionar, adicione id="th-avg-cost" no <th> do custo médio no HTML:
 *   <th id="th-avg-cost">Custo méd. unit.</th>
 */
function updateCostModeLabels() {
  const mode = getCostMode();
  const th = $('#th-avg-cost');
  if (th) {
    th.textContent =
      mode === 'saleDay'
        ? 'Custo méd. unit. (Dia da venda)'
        : 'Custo méd. unit. (Atual)';
  }
}

// =========================================================
// ✅ ANO select
// =========================================================
function setupYearSelect({ pastYears = 12, futureYears = 1, defaultToCurrentYear = true } = {}) {
  const yearEl = $('#filter-year');
  if (!yearEl) return;
  if (yearEl.dataset.filled === 'true') return;

  const now = new Date();
  const current = now.getFullYear();

  const firstOpt = yearEl.querySelector('option[value=""]');
  yearEl.innerHTML = '';
  if (firstOpt) yearEl.appendChild(firstOpt);
  else {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Ano opcional';
    yearEl.appendChild(opt);
  }

  const start = current + Number(futureYears || 0);
  const end = current - Number(pastYears || 0);

  for (let y = start; y >= end; y--) {
    const opt = document.createElement('option');
    opt.value = String(y);
    opt.textContent = String(y);
    yearEl.appendChild(opt);
  }

  if (defaultToCurrentYear) yearEl.value = String(current);
  yearEl.dataset.filled = 'true';
}

// =========================================================
// API
// =========================================================
async function fetchSalesReport(filters = {}) {
  const params = new URLSearchParams();

  if (filters.dateStart) params.append('dateStart', filters.dateStart);
  if (filters.dateEnd) params.append('dateEnd', filters.dateEnd);
  if (filters.customerId) params.append('customerId', filters.customerId);
  if (filters.productId) params.append('productId', filters.productId);
  if (filters.sellerId) params.append('sellerId', filters.sellerId);
  if (filters.costMode) params.append('costMode', filters.costMode);

  const qs = params.toString();
  const url = '/api/reports/sales' + (qs ? `?${qs}` : '');

  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Falha ao buscar relatório: ${res.status} – ${txt}`);
  }

  const json = await res.json();
  if (!json?.ok) throw new Error(json?.message || 'Erro na API de relatório de vendas.');
  return json;
}

// =========================================================
// Render KPIs
// =========================================================
function renderSummary(summary = {}) {
  const orders = Number(summary.orders_count || 0);
  const items = Number(summary.total_items || 0);
  const totalAmount = Number(summary.total_amount || 0);
  const totalCost = Number(summary.total_cost || 0);

  const elOrders = $('#summary-orders');
  const elItems = $('#summary-items');
  const elTotal = $('#summary-total');
  const elTicket = $('#summary-ticket');
  const elGross = $('#summary-gross-profit');

  if (elOrders) elOrders.textContent = orders.toString();
  if (elItems) elItems.textContent = items.toString();
  if (elTotal) elTotal.textContent = moneyBR(totalAmount);
  if (elTicket) elTicket.textContent = orders > 0 ? moneyBR(totalAmount / orders) : 'R$ 0,00';

  let grossProfit = Number(summary.gross_profit);
  if (!Number.isFinite(grossProfit)) grossProfit = totalAmount - totalCost;

  if (elGross) elGross.textContent = moneyBR(grossProfit);
}

// =========================================================
// Tables
// =========================================================
function renderByDay(rows = []) {
  const tbody = $('#tbody-by-day');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="sr-table-empty">Nenhum registro encontrado.</td></tr>`;
    return;
  }

  for (const r of rows) {
    const tr = document.createElement('tr');
    const day = r.day ? new Date(r.day).toLocaleDateString('pt-BR') : '-';
    tr.innerHTML = `
      <td>${day}</td>
      <td>${Number(r.orders_count || 0)}</td>
      <td>${Number(r.total_items || 0)}</td>
      <td>${moneyBR(r.total_amount)}</td>
    `;
    tbody.appendChild(tr);
  }
}

function renderByCustomer(rows = []) {
  const tbody = $('#tbody-by-customer');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="sr-table-empty">Nenhum registro encontrado.</td></tr>`;
    return;
  }

  for (const r of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.customer_name || '(Sem nome)'}</td>
      <td>${r.customer_id ?? '-'}</td>
      <td>${Number(r.orders_count || 0)}</td>
      <td>${moneyBR(r.total_amount)}</td>
    `;
    tbody.appendChild(tr);
  }
}

function renderByProduct(rows = []) {
  const tbody = $('#tbody-by-product');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="sr-table-empty">Nenhum registro encontrado.</td></tr>`;
    return;
  }

  for (const r of rows) {
    // ✅ backend novo: sku + unit (linhas separadas)
    const code = r.product_sku || r.product_code || r.product_id || '-';
    const desc = r.product_description || '(Sem descrição)';
    const um = r.product_unit || r.unit || '-';

    const qty = Number(r.total_items || 0);
    const totalAmount = Number(r.total_amount || 0);
    const totalCost = Number(r.total_cost || 0);

    const avgUnitPrice = Number(r.avg_unit_price || 0);

    // ✅ CORRETO: avg_unit_cost (não avg_cost_price)
    const avgCostPrice = Number(r.avg_unit_cost ?? r.avg_cost_price ?? 0);

    let grossProfit = Number(r.gross_profit);
    if (!Number.isFinite(grossProfit)) grossProfit = totalAmount - totalCost;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${code}</td>
      <td>${desc}</td>
      <td>${um}</td>
      <td>${qty}</td>
      <td>${moneyBR(avgUnitPrice)}</td>
      <td>${moneyBR(avgCostPrice)}</td>
      <td>${moneyBR(totalAmount)}</td>
      <td>${moneyBR(totalCost)}</td>
      <td>${moneyBR(grossProfit)}</td>
    `;
    tbody.appendChild(tr);
  }
}

// =========================================================
// Tabs
// =========================================================
function setupTabs() {
  const tabButtons = $$('.sr-tab-button');
  const panels = $$('.sr-tab-panel');

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      tabButtons.forEach((b) => b.classList.toggle('is-active', b === btn));
      panels.forEach((p) => p.classList.toggle('is-active', p.dataset.panel === tab));
    });
  });
}

// =========================================================
// Modal Filters
// =========================================================
function setupSellerModalFilter() {
  const input = $('#filter-seller-id');
  if (!input) return;

  input.readOnly = true;

  input.addEventListener('click', () => {
    try {
      openSellersModalSearch({
        apiBase: window.apiBase || '',
        onPick(seller) {
          const id =
            seller.seller_id ??
            seller.id ??
            seller.sellerId ??
            seller.vendedor_id ??
            seller.vendedorId ??
            seller.user_id ??
            null;

          const name =
            seller.name ??
            seller.seller_name ??
            seller.nome ??
            seller.nome_vendedor ??
            seller.full_name ??
            seller.fullName ??
            seller.apelido ??
            seller.nickname ??
            '';

          const doc =
            seller.cpf ??
            seller.cnpj ??
            seller.document ??
            seller.doc ??
            seller.tax_id ??
            '';

          if (!id) return;

          input.value = `${id} - ${name}${doc ? ` (${doc})` : ''}`.trim();
          input.dataset.sellerId = String(id);
        }
      });
    } catch (err) {
      console.error('[salesReport] Erro ao abrir modal de vendedores', err);
      showMessage({
        variant: 'error',
        title: 'Erro ao abrir pesquisa de vendedores',
        message: 'Não foi possível abrir o modal de vendedores.'
      });
    }
  });
}

function setupCustomerModalFilter() {
  const input = $('#filter-customer-id');
  if (!input) return;

  input.readOnly = true;

  input.addEventListener('click', () => {
    try {
      openCustomersModalSearch({
        apiBase: window.apiBase || '',
        onPick(customer) {
          const id = customer.id || customer.customer_id;
          const name = customer.name || customer.customer_name || '';
          if (!id) return;

          input.value = `${id} - ${name}`.trim();
          input.dataset.customerId = String(id);
        }
      });
    } catch (err) {
      console.error('[salesReport] Erro ao abrir modal de clientes', err);
      showMessage({
        variant: 'error',
        title: 'Erro ao abrir pesquisa de clientes',
        message: 'Não foi possível abrir o modal de clientes.'
      });
    }
  });
}

function setupProductModalFilter() {
  const input = $('#filter-product-id');
  if (!input) return;

  input.readOnly = true;

  input.addEventListener('click', () => {
    try {
      openProductsModalSearch({
        apiBase: window.apiBase || '',
        onPick(product) {
          const code = product.product_code || product.sku || product.code || product.product_sku;
          const name = product.name || product.description || product.product_description || '';
          if (!code) return;

          input.value = `${code} - ${name}`.trim();
          input.dataset.productCode = String(code);
        }
      });
    } catch (err) {
      console.error('[salesReport] Erro ao abrir modal de produtos', err);
      showMessage({
        variant: 'error',
        title: 'Erro ao abrir pesquisa de produtos',
        message: 'Não foi possível abrir o modal de produtos.'
      });
    }
  });
}

// =========================================================
// Filters
// =========================================================
function getFiltersFromDOM() {
  let dateStart = $('#filter-date-start')?.value || null;
  let dateEnd = $('#filter-date-end')?.value || null;

  const month = $('#filter-month')?.value || '';
  const yearInput = safeTrim($('#filter-year')?.value);

  if (month) {
    const now = new Date();
    const year = yearInput || String(now.getFullYear());

    const yearEl = $('#filter-year');
    if (yearEl && !yearEl.value) yearEl.value = String(now.getFullYear());

    const m = String(month).padStart(2, '0');
    const lastDay = new Date(Number(year), Number(month), 0).getDate();
    const dEnd = String(lastDay).padStart(2, '0');

    dateStart = `${year}-${m}-01`;
    dateEnd = `${year}-${m}-${dEnd}`;
  }

  const customerInput = $('#filter-customer-id');
  const productInput = $('#filter-product-id');
  const sellerInput = $('#filter-seller-id');

  const customerId = customerInput
    ? normalizeIdLike(customerInput.value, customerInput.dataset.customerId)
    : '';

  const productId = productInput
    ? safeTrim(productInput.dataset.productCode || productInput.value)
    : '';

  const sellerId = sellerInput?.dataset?.sellerId || '';

  const costMode = getCostMode();

  return {
    dateStart,
    dateEnd,
    customerId: customerId || null,
    productId: productId || null,
    sellerId: sellerId || null,
    costMode,
  };
}

function resetFilters() {
  const dateStartEl = $('#filter-date-start');
  const dateEndEl = $('#filter-date-end');
  const sellerInput = $('#filter-seller-id');
  const customerInput = $('#filter-customer-id');
  const productInput = $('#filter-product-id');
  const monthEl = $('#filter-month');
  const yearEl = $('#filter-year');

  if (dateStartEl) dateStartEl.value = '';
  if (dateEndEl) dateEndEl.value = '';
  if (monthEl) monthEl.value = '';
  if (yearEl) yearEl.value = '';

  if (sellerInput) {
    sellerInput.value = '';
    delete sellerInput.dataset.sellerId;
  }
  if (customerInput) {
    customerInput.value = '';
    delete customerInput.dataset.customerId;
  }
  if (productInput) {
    productInput.value = '';
    delete productInput.dataset.productCode;
  }
}

// =========================================================
// Loader
// =========================================================
function setLoading(isLoading) {
  const root =
    document.querySelector('.page-sales-report') ||
    document.querySelector('.consart-container');

  if (root) root.dataset.loading = isLoading ? 'true' : 'false';

  const btnApply = $('#btn-apply-filters');
  if (!btnApply) return;

  btnApply.disabled = !!isLoading;
  btnApply.textContent = isLoading ? 'Carregando...' : '🔍 Aplicar filtros';
}

// =========================================================
// CSV Export (Excel-friendly)
// =========================================================
function exportCurrentTableToCsv() {
  const activePanel = $('.sr-tab-panel.is-active');
  if (!activePanel) {
    showMessage({ variant: 'info', title: 'Exportar CSV', message: 'Nenhuma aba ativa para exportar.' });
    return;
  }

  const table = activePanel.querySelector('table');
  if (!table) {
    showMessage({ variant: 'info', title: 'Exportar CSV', message: 'Nenhuma tabela disponível para exportação.' });
    return;
  }

  let csv = '';
  const rows = Array.from(table.querySelectorAll('tr'));

  rows.forEach((row) => {
    const cells = Array.from(row.querySelectorAll('th, td')).map((cell) => {
      const text = (cell.textContent || '').replace(/"/g, '""').trim();
      return `"${text}"`;
    });
    csv += cells.join(';') + '\n';
  });

  // ✅ BOM para Excel + UTF-8
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  const activeTab = $('.sr-tab-button.is-active');
  const suffix = activeTab?.dataset?.tab ? activeTab.dataset.tab : 'relatorio';
  const fileName = `salesReport_${suffix}_${new Date().toISOString().slice(0, 10)}.csv`;

  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// =========================================================
// PDF
// =========================================================
function openPdfReport(mode = 'full') {
  const filters = getFiltersFromDOM();
  const params = new URLSearchParams();

  if (filters.dateStart) params.append('dateStart', filters.dateStart);
  if (filters.dateEnd) params.append('dateEnd', filters.dateEnd);
  if (filters.customerId) params.append('customerId', filters.customerId);
  if (filters.productId) params.append('productId', filters.productId);
  if (filters.sellerId) params.append('sellerId', filters.sellerId);
  if (filters.costMode) params.append('costMode', filters.costMode);

  if (mode) params.append('mode', mode);

  const qs = params.toString();
  const url = '/api/reports/sales/pdf' + (qs ? `?${qs}` : '');
  window.open(url, '_blank');
}

// =========================================================
// Back button
// =========================================================
function setupBackButton() {
  const btnBack = $('#btn-back');
  if (!btnBack) return;
  btnBack.addEventListener('click', () => window.history.back());
}

// =========================================================
// Main flow
// =========================================================
async function loadAndRenderSalesReport(initial = false) {
  try {
    setLoading(true);

    const filters = initial ? {} : getFiltersFromDOM();
    const data = await fetchSalesReport(filters);

    renderSummary(data.summary || {});
    renderByDay(data.byDay || []);
    renderByCustomer(data.byCustomer || []);
    renderByProduct(data.byProduct || []);
  } catch (err) {
    console.error('[salesReport] Erro ao carregar relatório', err);
    showMessage({
      variant: 'error',
      title: 'Erro ao carregar relatório',
      message: err?.message || 'Verifique o console para mais detalhes.'
    });
  } finally {
    setLoading(false);
  }
}

// =========================================================
// Init
// =========================================================
function init() {
  setupTabs();
  setupBackButton();
  setupYearSelect({ pastYears: 12, futureYears: 1, defaultToCurrentYear: false });

  setupSellerModalFilter();
  setupCustomerModalFilter();
  setupProductModalFilter();

  // ✅ cost toggle
  updateCostModeButton();
  updateCostModeLabels();

  $('#btn-cost-mode')?.addEventListener('click', async () => {
    toggleCostMode();
    updateCostModeButton();
    updateCostModeLabels();
    await loadAndRenderSalesReport(false);
  });

  $('#btn-apply-filters')?.addEventListener('click', () => loadAndRenderSalesReport(false));
  $('#btn-reset-filters')?.addEventListener('click', () => resetFilters());
  $('#btn-export-csv')?.addEventListener('click', () => exportCurrentTableToCsv());

  $('#btn-pdf-full')?.addEventListener('click', () => openPdfReport('full'));
  $('#btn-pdf-products')?.addEventListener('click', () => openPdfReport('products'));
  $('#btn-pdf-orders')?.addEventListener('click', () => openPdfReport('orders'));
}

document.addEventListener('DOMContentLoaded', init);