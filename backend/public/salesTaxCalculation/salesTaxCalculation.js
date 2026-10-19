// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: salesTaxCalculation.js                                         ║
// ║ MODULE: SALES TAX CALCULATION                                        ║
// ║ PRODNEX ERP                                                          ║
// ║ FRONTEND LOGIC                                                       ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

const API_BASE = `${window.location.origin}/api`;

const dom = {
  dateFromInput: document.getElementById('dateFromInput'),
  dateToInput: document.getElementById('dateToInput'),

  btnCalculatePeriod: document.getElementById('btnCalculatePeriod'),
  btnRefreshList: document.getElementById('btnRefreshList'),
  btnGeneratePdf: document.getElementById('btnGeneratePdf'),
  btnGenerateExcel: document.getElementById('btnGenerateExcel'),

  feedbackBox: document.getElementById('feedbackBox'),

  tbodyCalculations: document.getElementById('tbodyCalculations'),
  tbodyItems: document.getElementById('tbodyItems'),
  tbodyReconciliation: document.getElementById('tbodyReconciliation'),

  cardGrossTotal: document.getElementById('cardGrossTotal'),
  cardDiscountTotal: document.getElementById('cardDiscountTotal'),
  cardNetTotal: document.getElementById('cardNetTotal'),
  cardTaxBurdenTotal: document.getElementById('cardTaxBurdenTotal'),
  cardCostTotal: document.getElementById('cardCostTotal'),
  cardGrossProfitTotal: document.getElementById('cardGrossProfitTotal'),
  cardMarginPercent: document.getElementById('cardMarginPercent'),

  detailDateFrom: document.getElementById('detailDateFrom'),
  detailDateTo: document.getElementById('detailDateTo'),
  detailCalculationsCount: document.getElementById('detailCalculationsCount'),
  detailPeriodLabel: document.getElementById('detailPeriodLabel'),
  detailIcmsTotal: document.getElementById('detailIcmsTotal'),
  detailPisTotal: document.getElementById('detailPisTotal'),
  detailCofinsTotal: document.getElementById('detailCofinsTotal'),
  detailIpiTotal: document.getElementById('detailIpiTotal'),
  detailFcpTotal: document.getElementById('detailFcpTotal'),
  detailFreightTotal: document.getElementById('detailFreightTotal')
};


/* ======================================================================
   HELPERS
   ====================================================================== */

function moneyBR(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function numberBR(value, digits = 4) {
  return Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDateBR(dateValue) {
  if (!dateValue) return '-';

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return String(dateValue);

  return date.toLocaleDateString('pt-BR');
}

function setFeedback(message, type = 'success') {
  if (!dom.feedbackBox) return;
  dom.feedbackBox.hidden = false;
  dom.feedbackBox.textContent = message;
  dom.feedbackBox.className = `tax-feedback tax-feedback--${type}`;
}

function clearFeedback() {
  if (!dom.feedbackBox) return;
  dom.feedbackBox.hidden = true;
  dom.feedbackBox.textContent = '';
  dom.feedbackBox.className = 'tax-feedback';
}

async function fetchJSON(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json'
    },
    ...options
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(
      data?.details ||
      data?.error ||
      `HTTP ${response.status}`
    );
  }

  return data;
}

function getCurrentPeriod() {
  return {
    date_from: dom.dateFromInput?.value?.trim() || '',
    date_to: dom.dateToInput?.value?.trim() || ''
  };
}

function validatePeriod() {
  const { date_from, date_to } = getCurrentPeriod();

  if (!date_from || !date_to) {
    throw new Error('Informe a data inicial e a data final.');
  }

  if (date_from > date_to) {
    throw new Error('A data inicial não pode ser maior que a data final.');
  }

  return { date_from, date_to };
}

function getCurrentPeriodOrThrow() {
  return validatePeriod();
}

function setButtonLoading(button, loadingText, isLoading) {
  if (!button) return;

  if (!button.dataset.originalText) {
    button.dataset.originalText = button.textContent || '';
  }

  button.disabled = isLoading;
  button.textContent = isLoading
    ? loadingText
    : button.dataset.originalText;
}


/* ======================================================================
   RESET
   ====================================================================== */

function resetDetails() {
  dom.cardGrossTotal.textContent = moneyBR(0);
  dom.cardDiscountTotal.textContent = moneyBR(0);
  dom.cardNetTotal.textContent = moneyBR(0);
  dom.cardTaxBurdenTotal.textContent = moneyBR(0);
  dom.cardCostTotal.textContent = moneyBR(0);
  dom.cardGrossProfitTotal.textContent = moneyBR(0);
  dom.cardMarginPercent.textContent = `${numberBR(0)}%`;

  dom.detailDateFrom.textContent = '-';
  dom.detailDateTo.textContent = '-';
  dom.detailCalculationsCount.textContent = '0';
  dom.detailPeriodLabel.textContent = '-';
  dom.detailIcmsTotal.textContent = moneyBR(0);
  dom.detailPisTotal.textContent = moneyBR(0);
  dom.detailCofinsTotal.textContent = moneyBR(0);
  dom.detailIpiTotal.textContent = moneyBR(0);
  dom.detailFcpTotal.textContent = moneyBR(0);
  dom.detailFreightTotal.textContent = moneyBR(0);

  dom.tbodyItems.innerHTML = `
    <tr><td colspan="15" class="tax-empty">Nenhum item carregado.</td></tr>
  `;

  dom.tbodyReconciliation.innerHTML = `
    <tr><td colspan="10" class="tax-empty">Nenhuma divergência carregada.</td></tr>
  `;
}


/* ======================================================================
   RENDER
   ====================================================================== */

function renderSummary(data) {
  const summary = data?.summary || {};

  dom.cardGrossTotal.textContent = moneyBR(summary.gross_total);
  dom.cardDiscountTotal.textContent = moneyBR(summary.discount_total);
  dom.cardNetTotal.textContent = moneyBR(summary.net_total);
  dom.cardTaxBurdenTotal.textContent = moneyBR(summary.tax_burden_total);
  dom.cardCostTotal.textContent = moneyBR(summary.cost_total);
  dom.cardGrossProfitTotal.textContent = moneyBR(summary.gross_profit_total);
  dom.cardMarginPercent.textContent = `${numberBR(summary.margin_percent)}%`;

  dom.detailDateFrom.textContent = formatDateBR(data.date_from);
  dom.detailDateTo.textContent = formatDateBR(data.date_to);
  dom.detailCalculationsCount.textContent = String(summary.calculations_count || 0);
  dom.detailPeriodLabel.textContent = `${formatDateBR(data.date_from)} até ${formatDateBR(data.date_to)}`;
  dom.detailIcmsTotal.textContent = moneyBR(summary.icms_total);
  dom.detailPisTotal.textContent = moneyBR(summary.pis_total);
  dom.detailCofinsTotal.textContent = moneyBR(summary.cofins_total);
  dom.detailIpiTotal.textContent = moneyBR(summary.ipi_total);
  dom.detailFcpTotal.textContent = moneyBR(summary.fcp_total);
  dom.detailFreightTotal.textContent = moneyBR(summary.freight_total);
}

function renderCalculations(rows = []) {
  if (!Array.isArray(rows) || !rows.length) {
    dom.tbodyCalculations.innerHTML = `
      <tr><td colspan="9" class="tax-empty">Nenhum cálculo carregado.</td></tr>
    `;
    return;
  }

  dom.tbodyCalculations.innerHTML = rows.map(row => `
    <tr>
      <td>${row.sales_tax_calc_id}</td>
      <td>${row.order_number ?? row.order_id ?? '-'}</td>
      <td>${formatDateBR(row.issue_date)}</td>
      <td>${escapeHtml(row.customer_name || '')}</td>
      <td>${moneyBR(row.net_total)}</td>
      <td>${moneyBR(row.tax_burden_total)}</td>
      <td>${moneyBR(row.gross_profit_total)}</td>
      <td>${numberBR(row.margin_percent)}%</td>
      <td>
        <button
          class="btn-action"
          type="button"
          data-action="view"
          data-id="${row.sales_tax_calc_id}">
          Ver
        </button>
      </td>
    </tr>
  `).join('');
}

function renderItems(items = []) {
  if (!Array.isArray(items) || !items.length) {
    dom.tbodyItems.innerHTML = `
      <tr><td colspan="15" class="tax-empty">Nenhum item carregado.</td></tr>
    `;
    return;
  }

  dom.tbodyItems.innerHTML = items.map(item => {
    const marginClass = Number(item.gross_margin_percent || 0) < 0
      ? 'tax-text-danger'
      : 'tax-text-success';

    return `
      <tr>
        <td>${escapeHtml(item.sku)}</td>
        <td>${escapeHtml(item.description)}</td>
        <td>${numberBR(item.quantity, 3)}</td>
        <td>${escapeHtml(item.unit || '')}</td>
        <td>${moneyBR(item.unit_price)}</td>
        <td>${moneyBR(item.net_value)}</td>
        <td>${moneyBR(item.cost_total)}</td>
        <td>${moneyBR(item.icms_value)}</td>
        <td>${moneyBR(item.pis_value)}</td>
        <td>${moneyBR(item.cofins_value)}</td>
        <td>${moneyBR(item.ipi_value)}</td>
        <td>${moneyBR(item.fcp_value)}</td>
        <td>${moneyBR(item.estimated_tax_burden)}</td>
        <td>${moneyBR(item.gross_profit_value)}</td>
        <td class="${marginClass}">${numberBR(item.gross_margin_percent)}%</td>
      </tr>
    `;
  }).join('');
}

function renderReconciliation(rows = []) {
  if (!Array.isArray(rows) || !rows.length) {
    dom.tbodyReconciliation.innerHTML = `
      <tr><td colspan="10" class="tax-empty">Nenhuma divergência carregada.</td></tr>
    `;
    return;
  }

  dom.tbodyReconciliation.innerHTML = rows.map(row => {
    const status = String(row.status || 'OPEN').toUpperCase();
    const badgeClass = status === 'RESOLVED'
      ? 'tax-badge tax-badge--resolved'
      : 'tax-badge tax-badge--open';

    return `
      <tr>
        <td>${row.reconciliation_id ?? '-'}</td>
        <td>${row.order_id ?? '-'}</td>
        <td>${row.order_item_id ?? '-'}</td>
        <td>${escapeHtml(row.sku || '')}</td>
        <td>${escapeHtml(row.divergence_type || '')}</td>
        <td>${row.expected_value == null ? '-' : moneyBR(row.expected_value)}</td>
        <td>${row.actual_value == null ? '-' : moneyBR(row.actual_value)}</td>
        <td>${row.difference_value == null ? '-' : moneyBR(row.difference_value)}</td>
        <td><span class="${badgeClass}">${escapeHtml(status)}</span></td>
        <td>${escapeHtml(row.details || '')}</td>
      </tr>
    `;
  }).join('');
}


/* ======================================================================
   API
   ====================================================================== */

async function calculatePeriod(date_from, date_to) {
  return fetchJSON(`${API_BASE}/sales-tax/calculate-period`, {
    method: 'POST',
    body: JSON.stringify({ date_from, date_to })
  });
}

async function loadPeriodSummary(date_from, date_to) {
  const qs = new URLSearchParams({ date_from, date_to });
  return fetchJSON(`${API_BASE}/sales-tax/period?${qs.toString()}`);
}

async function loadCalculationById(id) {
  return fetchJSON(`${API_BASE}/sales-tax/${id}`);
}


/* ======================================================================
   EXPORTS
   ====================================================================== */

function handleGeneratePdf() {
  try {
    clearFeedback();

    const { date_from, date_to } = getCurrentPeriodOrThrow();
    const qs = new URLSearchParams({ date_from, date_to });

    window.open(`${API_BASE}/sales-tax/export/pdf?${qs.toString()}`, '_blank');

  } catch (error) {
    console.error(error);
    setFeedback(`Erro ao gerar PDF: ${error.message}`, 'error');
  }
}

function handleGenerateExcel() {
  try {
    clearFeedback();

    const { date_from, date_to } = getCurrentPeriodOrThrow();
    const qs = new URLSearchParams({ date_from, date_to });

    window.open(`${API_BASE}/sales-tax/export/excel?${qs.toString()}`, '_blank');

  } catch (error) {
    console.error(error);
    setFeedback(`Erro ao gerar Excel: ${error.message}`, 'error');
  }
}


/* ======================================================================
   EVENTS
   ====================================================================== */

async function handleCalculatePeriodClick() {
  try {
    clearFeedback();

    const { date_from, date_to } = validatePeriod();

    setButtonLoading(dom.btnCalculatePeriod, 'Calculando...', true);

    const result = await calculatePeriod(date_from, date_to);

    setFeedback(
      `Período calculado com sucesso. Pedidos encontrados: ${result.orders_found}. Cálculos gerados: ${result.calculated_count}.`,
      'success'
    );

    const periodData = await loadPeriodSummary(date_from, date_to);

    renderSummary(periodData);
    renderCalculations(periodData.calculations || []);
    renderItems(periodData.items || []);
    renderReconciliation(periodData.reconciliation || []);

  } catch (error) {
    console.error(error);
    setFeedback(`Erro ao calcular período: ${error.message}`, 'error');
  } finally {
    setButtonLoading(dom.btnCalculatePeriod, 'Calculando...', false);
  }
}

async function handleRefreshClick() {
  try {
    clearFeedback();

    const { date_from, date_to } = validatePeriod();

    setButtonLoading(dom.btnRefreshList, 'Atualizando...', true);

    const periodData = await loadPeriodSummary(date_from, date_to);

    renderSummary(periodData);
    renderCalculations(periodData.calculations || []);
    renderItems(periodData.items || []);
    renderReconciliation(periodData.reconciliation || []);

  } catch (error) {
    console.error(error);
    setFeedback(`Erro ao atualizar período: ${error.message}`, 'error');
  } finally {
    setButtonLoading(dom.btnRefreshList, 'Atualizando...', false);
  }
}

async function handleCalculationsTableClick(event) {
  const button = event.target.closest('button[data-action="view"]');
  if (!button) return;

  const id = button.dataset.id;
  if (!id) return;

  try {
    clearFeedback();

    const data = await loadCalculationById(id);

    if (data?.header) {
      dom.cardGrossTotal.textContent = moneyBR(data.header.gross_total);
      dom.cardDiscountTotal.textContent = moneyBR(data.header.discount_total);
      dom.cardNetTotal.textContent = moneyBR(data.header.net_total);
      dom.cardTaxBurdenTotal.textContent = moneyBR(data.header.tax_burden_total);
      dom.cardCostTotal.textContent = moneyBR(data.header.cost_total);
      dom.cardGrossProfitTotal.textContent = moneyBR(data.header.gross_profit_total);
      dom.cardMarginPercent.textContent = `${numberBR(data.header.margin_percent)}%`;

      dom.detailDateFrom.textContent = formatDateBR(data.header.issue_date);
      dom.detailDateTo.textContent = formatDateBR(data.header.issue_date);
      dom.detailCalculationsCount.textContent = '1';
      dom.detailPeriodLabel.textContent = `Pedido ${data.header.order_number ?? data.header.order_id ?? '-'}`;
      dom.detailIcmsTotal.textContent = moneyBR(data.header.icms_total);
      dom.detailPisTotal.textContent = moneyBR(data.header.pis_total);
      dom.detailCofinsTotal.textContent = moneyBR(data.header.cofins_total);
      dom.detailIpiTotal.textContent = moneyBR(data.header.ipi_total);
      dom.detailFcpTotal.textContent = moneyBR(data.header.fcp_total);
      dom.detailFreightTotal.textContent = moneyBR(data.header.freight_total);
    }

    renderItems(data.items || []);
    renderReconciliation(data.reconciliation || []);

  } catch (error) {
    console.error(error);
    setFeedback(`Erro ao carregar apuração: ${error.message}`, 'error');
  }
}


/* ======================================================================
   DEFAULT PERIOD
   ====================================================================== */

function setDefaultDates() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const lastDay = String(new Date(year, now.getMonth() + 1, 0).getDate()).padStart(2, '0');

  if (dom.dateFromInput) dom.dateFromInput.value = `${year}-${month}-01`;
  if (dom.dateToInput) dom.dateToInput.value = `${year}-${month}-${lastDay}`;
}


/* ======================================================================
   INIT
   ====================================================================== */

async function init() {
  try {
    resetDetails();
    clearFeedback();
    setDefaultDates();

    const { date_from, date_to } = getCurrentPeriod();
    if (!date_from || !date_to) return;

    const periodData = await loadPeriodSummary(date_from, date_to);

    renderSummary(periodData);
    renderCalculations(periodData.calculations || []);
    renderItems(periodData.items || []);
    renderReconciliation(periodData.reconciliation || []);

  } catch (error) {
    console.error(error);
    setFeedback(`Erro ao inicializar módulo: ${error.message}`, 'error');
  }
}

dom.btnCalculatePeriod?.addEventListener('click', handleCalculatePeriodClick);
dom.btnRefreshList?.addEventListener('click', handleRefreshClick);
dom.btnGeneratePdf?.addEventListener('click', handleGeneratePdf);
dom.btnGenerateExcel?.addEventListener('click', handleGenerateExcel);
dom.tbodyCalculations?.addEventListener('click', handleCalculationsTableClick);

init();