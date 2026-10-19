// ╔════════════════════════════════════════════════════════════════════╗
// ║ pdvSalesReport.js — Relatório de Vendas PDV (Frontend ESM)        ║
// ║ PRODNEX ERP — Consome /api/reports/pdv-sales                       ║
// ║ HTML base: pdvSalesReport.html (estrutura sr-*)                    ║
// ╚════════════════════════════════════════════════════════════════════╝

const API_BASE =
  (typeof window !== 'undefined' && (window.API_BASE || window.apiBase)) ||
  window.location.origin;

const REPORT_ENDPOINT = `${API_BASE}/api/reports/pdv-sales`;
const REPORT_PDF_ENDPOINT = `${API_BASE}/api/reports/pdv-sales/pdf`;
const REPORT_CSV_ENDPOINT = `${API_BASE}/api/reports/pdv-sales/csv`;

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

function formatCurrencyBR(value) {
  const n = Number(value || 0);
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function formatDateBR(dateIso) {
  if (!dateIso) return '';
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo'
  });
}

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// ---------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------

// Filtros
const filterDateStart = $('#filter-date-start');
const filterDateEnd = $('#filter-date-end');
const filterCustomerId = $('#filter-customer-id');
const filterProductId = $('#filter-product-id');
const filterMonth = $('#filter-month');
const filterYear = $('#filter-year');

const btnApplyFilters = $('#btn-apply-filters');
const btnResetFilters = $('#btn-reset-filters');

// KPIs
const summaryTotal = $('#summary-total');
const summaryOrders = $('#summary-orders');
const summaryItems = $('#summary-items');
const summaryTicket = $('#summary-ticket');
const summaryGrossProfit = $('#summary-gross-profit');

// Abas e painéis
const tabButtons = $$('.sr-tab-button');
const tabPanels = $$('.sr-tab-panel');

const tbodyByDay = $('#tbody-by-day');
const tbodyByCustomer = $('#tbody-by-customer');
const tbodyByProduct = $('#tbody-by-product'); // aqui usamos para "por cupom"

// Rodapé / ações de exportação
const btnPdfFull = $('#btn-pdf-full');
const btnPdfProducts = $('#btn-pdf-products');
const btnPdfOrders = $('#btn-pdf-orders');
const btnExportCsv = $('#btn-export-csv');

// ---------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------

let lastReportData = null;
let currentTab = 'day'; // 'day' | 'customer' | 'product'

// ---------------------------------------------------------------------
// Query / Filtros
// ---------------------------------------------------------------------

function buildQueryParams() {
  const params = new URLSearchParams();

  if (filterDateStart?.value) params.set('startDate', filterDateStart.value);
  if (filterDateEnd?.value) params.set('endDate', filterDateEnd.value);
  if (filterMonth?.value) params.set('month', filterMonth.value);
  if (filterYear?.value) params.set('year', filterYear.value);

  // Reservados para futuro
  if (filterCustomerId?.value) params.set('customerId', filterCustomerId.value);
  if (filterProductId?.value) params.set('productId', filterProductId.value);

  return params.toString();
}

function clearFilters() {
  if (filterDateStart) filterDateStart.value = '';
  if (filterDateEnd) filterDateEnd.value = '';
  if (filterCustomerId) filterCustomerId.value = '';
  if (filterProductId) filterProductId.value = '';
  if (filterMonth) filterMonth.value = '';
  if (filterYear) filterYear.value = '';
}

// ---------------------------------------------------------------------
// Load / Fetch
// ---------------------------------------------------------------------

async function loadReport() {
  try {
    const qs = buildQueryParams();
    const url = qs ? `${REPORT_ENDPOINT}?${qs}` : REPORT_ENDPOINT;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Erro ao carregar relatório PDV: ${res.status}`);
    }

    const data = await res.json();
    lastReportData = data;

    renderSummary(data.summary);
    renderActiveTab(); // desenha a aba atual com os novos dados
  } catch (err) {
    console.error('[pdvSalesReport] loadReport error:', err);
    alert('Erro ao carregar relatório de vendas PDV. Verifique o console para mais detalhes.');
  }
}

// ---------------------------------------------------------------------
// Render: Summary (KPIs)
// ---------------------------------------------------------------------

function renderSummary(summary = {}) {
  const {
    totalSold = 0,
    orders = 0,
    itemsSold = 0,
    avgTicket = 0,
    grossProfit = 0
  } = summary || {};

  if (summaryTotal) summaryTotal.textContent = formatCurrencyBR(totalSold);
  if (summaryOrders) summaryOrders.textContent = String(orders);
  if (summaryItems) summaryItems.textContent = String(itemsSold);
  if (summaryTicket) summaryTicket.textContent = formatCurrencyBR(avgTicket);
  if (summaryGrossProfit) summaryGrossProfit.textContent = formatCurrencyBR(grossProfit);
}

// ---------------------------------------------------------------------
// Render: Tabelas por aba
// ---------------------------------------------------------------------

function renderTabDay() {
  if (!tbodyByDay) return;

  tbodyByDay.innerHTML = '';

  const rows = (lastReportData && lastReportData.detailByDay) || [];

  if (!rows.length) {
    tbodyByDay.innerHTML = `
      <tr>
        <td colspan="4" class="sr-table-empty">
          Nenhum dado para exibir com os filtros atuais.
        </td>
      </tr>
    `;
    return;
  }

  const frag = document.createDocumentFragment();

  rows.forEach((row) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatDateBR(row.date)}</td>
      <td>${row.orders ?? 0}</td>
      <td>${row.items ?? 0}</td>
      <td>${formatCurrencyBR(row.total)}</td>
    `;
    frag.appendChild(tr);
  });

  tbodyByDay.appendChild(frag);
}

function renderTabCustomer() {
  if (!tbodyByCustomer) return;

  tbodyByCustomer.innerHTML = '';

  const rows = (lastReportData && lastReportData.detailByCustomer) || [];

  if (!rows.length) {
    tbodyByCustomer.innerHTML = `
      <tr>
        <td colspan="4" class="sr-table-empty">
          Nenhum dado para exibir com os filtros atuais.
        </td>
      </tr>
    `;
    return;
  }

  const frag = document.createDocumentFragment();

  rows.forEach((row) => {
    const tr = document.createElement('tr');
    const customer = row.customer || 'CONSUMIDOR FINAL';
    tr.innerHTML = `
      <td>${customer}</td>
      <td>${row.orders ?? 0}</td>
      <td>${row.items ?? 0}</td>
      <td>${formatCurrencyBR(row.total)}</td>
    `;
    frag.appendChild(tr);
  });

  tbodyByCustomer.appendChild(frag);
}

function renderTabProductAsSale() {
  if (!tbodyByProduct) return;

  tbodyByProduct.innerHTML = '';

  const rows = (lastReportData && lastReportData.detailBySale) || [];

  if (!rows.length) {
    tbodyByProduct.innerHTML = `
      <tr>
        <td colspan="5" class="sr-table-empty">
          Nenhum dado para exibir com os filtros atuais.
        </td>
      </tr>
    `;
    return;
  }

  const frag = document.createDocumentFragment();

  rows.forEach((row) => {
    const tr = document.createElement('tr');
    const customer = row.customer || 'CONSUMIDOR FINAL';

    tr.innerHTML = `
      <td>${formatDateBR(row.date)}</td>
      <td>${row.couponNumber || row.nfceNumber || row.id || ''}</td>
      <td>${customer}</td>
      <td>${row.items ?? 0}</td>
      <td>${formatCurrencyBR(row.total)}</td>
    `;
    frag.appendChild(tr);
  });

  tbodyByProduct.appendChild(frag);
}

// Decide qual aba desenhar
function renderActiveTab() {
  if (!lastReportData) return;

  switch (currentTab) {
    case 'day':
      renderTabDay();
      break;
    case 'customer':
      renderTabCustomer();
      break;
    case 'product': // aqui "product" está sendo usado como "cupom"
      renderTabProductAsSale();
      break;
    default:
      renderTabDay();
      break;
  }
}

// ---------------------------------------------------------------------
// Tabs: UI
// ---------------------------------------------------------------------

function setActiveTab(tabKey) {
  currentTab = tabKey;

  tabButtons.forEach((btn) => {
    const isActive = btn.dataset.tab === tabKey;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  tabPanels.forEach((panel) => {
    const panelKey = panel.dataset.panel;
    const isActive = panelKey === tabKey || (tabKey === 'product' && panelKey === 'sale');
    panel.classList.toggle('is-active', isActive);
    panel.hidden = !isActive;
  });

  renderActiveTab();
}

// ---------------------------------------------------------------------
// Export ações (PDF + CSV)
// ---------------------------------------------------------------------

function openPdf(mode) {
  // mode: 'full' | 'customers' | 'coupons'
  const baseQs = buildQueryParams();
  const params = new URLSearchParams(baseQs);
  params.set('mode', mode);

  const url = `${REPORT_PDF_ENDPOINT}?${params.toString()}`;
  window.open(url, '_blank', 'noopener');
}

function exportCsvCurrentView() {
  // view: 'day' | 'customer' | 'coupon'
  const baseQs = buildQueryParams();
  const params = new URLSearchParams(baseQs);

  let view = 'day';
  if (currentTab === 'customer') view = 'customer';
  if (currentTab === 'product') view = 'coupon';

  params.set('view', view);

  const url = `${REPORT_CSV_ENDPOINT}?${params.toString()}`;
  window.open(url, '_blank', 'noopener');
}

// ---------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------

btnApplyFilters?.addEventListener('click', () => {
  loadReport();
});

btnResetFilters?.addEventListener('click', () => {
  clearFilters();
  loadReport();
});

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const tabKey = btn.dataset.tab;
    if (!tabKey) return;
    setActiveTab(tabKey);
  });
});

// PDFs
btnPdfFull?.addEventListener('click', () => openPdf('full'));
btnPdfProducts?.addEventListener('click', () => openPdf('customers'));
btnPdfOrders?.addEventListener('click', () => openPdf('coupons'));

// CSV
btnExportCsv?.addEventListener('click', () => exportCsvCurrentView());

// ---------------------------------------------------------------------
// Inicialização
// ---------------------------------------------------------------------

// Carrega últimas 4 semanas ao abrir (padrão do backend: 30 dias)
loadReport();
