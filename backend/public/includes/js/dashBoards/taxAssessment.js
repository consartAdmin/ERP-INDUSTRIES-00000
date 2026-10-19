// ╔══════════════════════════════════════════════════════════════════════╗
// ║ taxAssessment.js — Dashboard: Apuração de Impostos (débito × crédito)║
// ║ PRODNEX ERP                                                        ║
// ║                                                                      ║
// ║ ✅ Débito (vendas) × crédito (compras e despesas) por imposto       ║
// ║ ✅ Saldo a recolher / saldo credor                                  ║
// ║ ✅ IRPJ / CSLL pelo Regime Tributário cadastrado                    ║
// ║ ✅ Mesmo filtro de período dos dashboards de Vendas e Impostos      ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
    moneyBR,
    fetchDashboard,
} from './dashboardUtils.js';

import { showCenterModal } from '/public/includes/js/centerAlertModal.js';


// ======================================================================
// CONFIG
// ======================================================================

const DASHBOARD_KEY =
    'tax-assessment';

const ENDPOINT =
    '/api/dashboard/tax-assessment';

const CHART = Object.freeze({
    width: 520,
    height: 260,
    labelWidth: 120,
    rightPad: 16,
    topPad: 22,
});

const COLORS = Object.freeze({
    debit: ['#be123c', '#fb7185'],
    credit: ['#047857', '#34d399'],
    deduction: ['#b45309', '#fbbf24'],
});

const DEDUCTION_LIMIT = 5;
const DEDUCTION_ROW = 22;


// ======================================================================
// DASHBOARD
// ======================================================================

export const taxAssessmentDashboard = {

    key: DASHBOARD_KEY,

    render() {

        return `
          <article
            class="dash-card dash-card--analytics dash-card--taxes"
            data-dashboard-key="${DASHBOARD_KEY}"
          >

            <div class="sales-analytics sales-taxes tax-assessment">

              <section class="sales-analytics__period" aria-label="Filtro por período">
                <label class="sales-analytics__period-field">
                  <span>Período</span>
                  <select data-ta-filter="periodMode">
                    <option value="current-month">Mês atual</option>
                    <option value="custom">Escolher período</option>
                  </select>
                </label>

                <div class="sales-analytics__custom-dates" data-ta-period-custom hidden>
                  <label class="sales-analytics__period-field">
                    <span>Data inicial</span>
                    <input type="date" data-ta-filter="startDate" />
                  </label>

                  <label class="sales-analytics__period-field">
                    <span>Data final</span>
                    <input type="date" data-ta-filter="endDate" />
                  </label>

                  <button type="button" class="sales-analytics__period-apply" data-ta-action="applyPeriod">
                    Aplicar
                  </button>
                </div>

                <span class="sales-taxes__coverage" data-ta-coverage></span>
                <span class="sales-taxes__regime" data-ta-regime></span>

                <div class="tax-assessment__export" aria-label="Baixar memória de cálculo">
                  <button type="button" class="tax-assessment__export-btn is-xlsx" data-ta-export="xlsx"
                    title="Baixar a memória de cálculo em Excel">
                    Excel
                  </button>
                  <button type="button" class="tax-assessment__export-btn is-pdf" data-ta-export="pdf"
                    title="Baixar a memória de cálculo em PDF">
                    PDF
                  </button>
                </div>

                <span class="sales-analytics__period-caption" data-ta-period-caption></span>
              </section>


              <!-- ==================================================== -->
              <!-- PANELS                                               -->
              <!-- ==================================================== -->

              <section class="sales-analytics__abc-row">

                <section class="analytics-chart analytics-chart--abc analytics-chart--ranking">
                  <header class="analytics-chart__header">
                    <h3>APURAÇÃO POR IMPOSTO</h3>
                  </header>
                  <div class="analytics-chart__body" data-ta-list="byTax" aria-label="Apuração por imposto"></div>
                </section>

                <section class="analytics-chart analytics-chart--abc">
                  <header class="analytics-chart__header">
                    <h3>GRÁFICO: DÉBITO × CRÉDITO</h3>
                  </header>
                  <div
                    class="analytics-chart__body analytics-product-pie-host"
                    data-ta-chart="bars"
                    role="img"
                    aria-label="Gráfico de débito e crédito por imposto"
                  ></div>
                </section>

                <section class="analytics-chart analytics-chart--abc analytics-chart--ranking">
                  <header class="analytics-chart__header">
                    <h3>CRÉDITOS POR ORIGEM</h3>
                  </header>
                  <div class="analytics-chart__body" data-ta-list="credits" aria-label="Créditos por origem"></div>
                </section>

                <section class="analytics-chart analytics-chart--abc analytics-chart--ranking">
                  <header class="analytics-chart__header">
                    <h3>RESULTADO ESTIMADO</h3>
                  </header>
                  <div class="analytics-chart__body" data-ta-list="result" aria-label="Resultado estimado"></div>
                </section>

              </section>


              <!-- ==================================================== -->
              <!-- KPI ROW                                              -->
              <!-- ==================================================== -->

              <section class="sales-analytics__kpi-row">

                <div class="analytics-kpi analytics-kpi--taxes kpi-w-20 kpi-h-2 kpi-p-1 kpi-radius-6">
                  <span class="analytics-kpi__label">DÉBITOS (VENDAS)</span>
                  <strong class="analytics-kpi__value" data-ta-field="debits">R$ 0,00</strong>
                </div>

                <div class="analytics-kpi analytics-kpi--credits kpi-w-20 kpi-h-2 kpi-p-1 kpi-radius-6">
                  <span class="analytics-kpi__label">CRÉDITOS (COMPRAS E DESPESAS)</span>
                  <strong class="analytics-kpi__value" data-ta-field="credits">R$ 0,00</strong>
                </div>

                <div class="analytics-kpi analytics-kpi--revenue kpi-w-20 kpi-h-2 kpi-p-1 kpi-radius-6">
                  <span class="analytics-kpi__label">A RECOLHER</span>
                  <strong class="analytics-kpi__value" data-ta-field="toPay">R$ 0,00</strong>
                </div>

                <div class="analytics-kpi analytics-kpi--ticket kpi-w-20 kpi-h-2 kpi-p-1 kpi-radius-6">
                  <span class="analytics-kpi__label">SALDO CREDOR (PRÓXIMO PERÍODO)</span>
                  <strong class="analytics-kpi__value" data-ta-field="creditBalance">R$ 0,00</strong>
                </div>

              </section>

            </div>

          </article>
        `;
    },

    async load(root) {

        const card = root.querySelector(`.dash-card[data-dashboard-key="${DASHBOARD_KEY}"]`);
        if (!card) return;

        try {
            bindPeriodFilter(card);
            bindExport(card);
            await loadAssessment(card);
        } catch (error) {
            console.error('[dashboard][tax-assessment] Failed to load:', error);
            renderError(card);
        }
    },
};


// ======================================================================
// LOAD
// ======================================================================

async function loadAssessment(card) {
    const data = await fetchDashboard(buildEndpoint(card));

    console.log('[dashboard][tax-assessment] Response:', data);

    const summary = data?.summary || {};
    const byTax = Array.isArray(data?.byTax) ? data.byTax : [];

    setText(card, 'debits', moneyBR(summary.debits || 0));
    setText(card, 'credits', moneyBR(summary.credits || 0));
    setText(card, 'toPay', moneyBR(summary.toPay || 0));
    setText(card, 'creditBalance', moneyBR(summary.creditBalance || 0));

    updateCoverage(card, summary, data?.sources || {});
    updateRegime(card, data?.regime);
    renderTaxRows(card, byTax);
    renderBars(
        card.querySelector('[data-ta-chart="bars"]'),
        byTax.filter((row) => row.debit > 0 || row.credit > 0),
        data?.result?.deductionsBySubcategory || []
    );
    renderCredits(card, Array.isArray(data?.creditOrigins) ? data.creditOrigins : []);
    renderResult(card, data?.result || {}, byTax, data?.regime);
    updatePeriodCaption(card, data?.filters);

    // Exports use the period on screen, not dates typed but not applied yet.
    card.dataset.taStartDate = data?.filters?.startDate || '';
    card.dataset.taEndDate = data?.filters?.endDate || '';
}


function renderError(card) {
    card.querySelectorAll('[data-ta-list], [data-ta-chart]').forEach((element) => {
        element.innerHTML = '<div class="analytics-abc-ranking__empty">Não foi possível carregar a apuração.</div>';
    });
}


// ======================================================================
// CHIPS
// ======================================================================

function updateCoverage(card, summary, sources) {
    const element = card.querySelector('[data-ta-coverage]');
    if (!element) return;

    const purchases = Number(summary.purchaseInvoices || 0);
    const notPosted = Number(summary.purchasesNotPosted || 0);
    const expenses = Number(summary.expenseEntries || 0);
    const cmv = Number(summary.cmvMovements || 0);

    const warning = !sources.purchases || (purchases === 0 && cmv === 0) || notPosted > 0;
    element.classList.toggle('sales-taxes__coverage--warning', warning);

    if (!sources.purchases) {
        element.textContent = 'Notas de entrada não encontradas';
        element.title = 'Sem a tabela de notas de entrada não há créditos para abater.';
        return;
    }

    element.textContent = `${formatInteger(purchases)} notas de entrada · ${formatInteger(cmv)} C.M.V · ${formatInteger(expenses)} despesas`;
    element.title = [
        `${formatInteger(summary.salesInvoices)} notas de venda geram os débitos.`,
        `${formatInteger(purchases)} notas de entrada (${moneyBR(summary.purchasesTotal || 0)}) geram os créditos de ICMS, IPI, PIS e COFINS.`,
        notPosted > 0 ? `${formatInteger(notPosted)} delas ainda não foram lançadas, mas já entram no cálculo.` : '',
        cmv > 0 ? `${formatInteger(cmv)} saídas de C.M.V no Caixa (${moneyBR(summary.cmvPurchases || 0)}) contam como compras para o crédito de PIS/COFINS no Lucro Real.` : '',
        `${formatInteger(expenses)} despesas (${moneyBR(summary.expensesTotal || 0)}); ${moneyBR(summary.creditableExpenses || 0)} marcadas como "gera crédito".`,
    ].filter(Boolean).join('\n');
}


function updateRegime(card, regime) {
    const element = card.querySelector('[data-ta-regime]');
    if (!element) return;

    element.classList.toggle('sales-taxes__regime--missing', !regime);

    if (!regime) {
        element.textContent = 'Regime não cadastrado';
        element.title = 'Sem regime, débitos e créditos seguem o que está destacado nas notas e o IRPJ/CSLL não é estimado.';
        return;
    }

    element.textContent = regime.label;
    element.title = regime.summary || regime.label;
}


// ======================================================================
// APURAÇÃO POR IMPOSTO
// ======================================================================

function renderTaxRows(card, rows) {
    const container = card.querySelector('[data-ta-list="byTax"]');
    if (!container) return;

    if (!rows.length) {
        container.innerHTML = '<div class="analytics-abc-ranking__empty">Sem movimento no período.</div>';
        return;
    }

    const maxValue = Math.max(...rows.map((row) => Math.max(row.debit, row.credit)), 1);

    container.innerHTML = `
      <div class="analytics-abc-ranking">
        ${rows.map((row) => {
        const status = row.note === 'Recolhido dentro do DAS'
            ? { text: 'DAS', tone: 'c' }
            : row.balance > 0
                ? { text: 'PAGAR', tone: 'a' }
                : row.balance < 0 ? { text: 'CREDOR', tone: 'b' } : { text: 'ZERO', tone: 'c' };

        const title = [
            `${row.label}`,
            `Débito: ${moneyBR(row.debit)}`,
            `Crédito: ${moneyBR(row.credit)}`,
            row.balance >= 0 ? `A recolher: ${moneyBR(row.balance)}` : `Saldo credor: ${moneyBR(-row.balance)}`,
            row.estimated ? 'Valor estimado pelo Regime Tributário.' : '',
            row.note || '',
        ].filter(Boolean).join('\n');

        return `
              <div class="analytics-abc-ranking__row tax-assessment__row${row.estimated ? ' tax-assessment__row--estimated' : ''}" title="${escapeHtml(title)}">
                <div class="analytics-abc-ranking__head">
                  <span class="analytics-abc-ranking__name">${escapeHtml(row.label)}</span>
                  <span class="analytics-abc-ranking__value">${moneyBR(Math.abs(row.balance))}</span>
                  <span class="analytics-abc-ranking__class analytics-abc-ranking__class--${status.tone} sales-taxes__rate">${status.text}</span>
                </div>
                <div class="tax-assessment__dc">
                  <span>D ${moneyBR(row.debit)}</span>
                  <span>C ${moneyBR(row.credit)}</span>
                </div>
                <div class="analytics-abc-ranking__track tax-assessment__track" aria-hidden="true">
                  <span class="tax-assessment__bar tax-assessment__bar--debit" style="width:${barWidth(row.debit, maxValue)}%"></span>
                  <span class="tax-assessment__bar tax-assessment__bar--credit" style="width:${barWidth(row.credit, maxValue)}%"></span>
                </div>
              </div>
            `;
    }).join('')}
      </div>
    `;
}


function barWidth(value, maxValue) {
    return value > 0 ? Math.max(2, Math.min(100, (value / maxValue) * 100)).toFixed(2) : '0';
}


// ======================================================================
// GRÁFICO: DÉBITO × CRÉDITO
// ======================================================================

function renderBars(container, rows, deductions = []) {
    if (!container) return;

    const deductionRows = (Array.isArray(deductions) ? deductions : [])
        .filter((item) => Number(item.value || 0) > 0)
        .slice(0, DEDUCTION_LIMIT);

    if (!rows.length && !deductionRows.length) {
        container.innerHTML = '<div class="analytics-product-pie__empty">Sem dados para exibir.</div>';
        return;
    }

    const visible = rows.length ? rows.slice(0, 7) : [];
    const maxValue = Math.max(...visible.map((row) => Math.max(row.debit, row.credit)), 1);
    const plotWidth = CHART.width - CHART.labelWidth - CHART.rightPad;
    const groupHeight = visible.length ? (CHART.height - CHART.topPad) / visible.length : 0;
    const barHeight = Math.min(14, (groupHeight - 6) / 2);

    const gradient = (id, [start, end]) => `
      <linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${start}"></stop>
        <stop offset="100%" stop-color="${end}"></stop>
      </linearGradient>`;

    const bars = visible.map((row, index) => {
        const y = CHART.topPad + index * groupHeight + (groupHeight - barHeight * 2 - 2) / 2;
        const debitWidth = (row.debit / maxValue) * plotWidth;
        const creditWidth = (row.credit / maxValue) * plotWidth;

        return `
          <g>
            <text class="tax-assessment__svg-label" x="${CHART.labelWidth - 8}" y="${(y + barHeight + 1).toFixed(1)}" text-anchor="end" dominant-baseline="middle">${escapeHtml(truncateText(shortLabel(row.label), 18))}</text>
            <rect x="${CHART.labelWidth}" y="${y.toFixed(1)}" width="${debitWidth.toFixed(1)}" height="${barHeight.toFixed(1)}" rx="3" fill="url(#ta-debit)">
              <title>${escapeHtml(row.label)} — débito ${moneyBR(row.debit)}</title>
            </rect>
            <rect x="${CHART.labelWidth}" y="${(y + barHeight + 2).toFixed(1)}" width="${creditWidth.toFixed(1)}" height="${barHeight.toFixed(1)}" rx="3" fill="url(#ta-credit)">
              <title>${escapeHtml(row.label)} — crédito ${moneyBR(row.credit)}</title>
            </rect>
          </g>
        `;
    }).join('');

    // Second block, own scale: cash outflows deducted from the IRPJ/CSLL base.
    // They are not tax credits, so they are drawn apart from the D × C pairs.
    const deductionTop = (visible.length ? CHART.height : CHART.topPad) + 8;
    const deductionMax = Math.max(...deductionRows.map((item) => Number(item.value || 0)), 1);
    const deductionBlock = deductionRows.length ? `
      <line x1="0" x2="${CHART.width}" y1="${deductionTop}" y2="${deductionTop}" stroke="#e2e8f0" stroke-dasharray="4 4"></line>
      <rect x="${CHART.labelWidth}" y="${deductionTop + 8}" width="10" height="10" rx="2" fill="url(#ta-deduction)"></rect>
      <text class="tax-assessment__svg-label" x="${CHART.labelWidth + 14}" y="${deductionTop + 14}" dominant-baseline="middle">Dedutível da base IRPJ/CSLL (não é crédito)</text>
      ${deductionRows.map((item, index) => {
        const y = deductionTop + 26 + index * DEDUCTION_ROW;
        const width = (Number(item.value) / deductionMax) * plotWidth;
        return `
          <g>
            <text class="tax-assessment__svg-label" x="${CHART.labelWidth - 8}" y="${(y + 7).toFixed(1)}" text-anchor="end" dominant-baseline="middle">${escapeHtml(truncateText(item.label, 18))}</text>
            <rect x="${CHART.labelWidth}" y="${y}" width="${width.toFixed(1)}" height="14" rx="3" fill="url(#ta-deduction)">
              <title>${escapeHtml(item.label)} — dedutível ${moneyBR(item.value)}</title>
            </rect>
          </g>`;
    }).join('')}
    ` : '';
    const height = deductionRows.length
        ? deductionTop + 26 + deductionRows.length * DEDUCTION_ROW
        : CHART.height;

    container.innerHTML = `
      <div class="analytics-product-pie">
        <svg viewBox="0 0 ${CHART.width} ${height}" aria-hidden="true" focusable="false">
          <defs>${gradient('ta-debit', COLORS.debit)}${gradient('ta-credit', COLORS.credit)}${gradient('ta-deduction', COLORS.deduction)}</defs>
          <g class="tax-assessment__legend">
            <rect x="${CHART.labelWidth}" y="4" width="10" height="10" rx="2" fill="url(#ta-debit)"></rect>
            <text class="tax-assessment__svg-label" x="${CHART.labelWidth + 14}" y="10" dominant-baseline="middle">Débito</text>
            <rect x="${CHART.labelWidth + 70}" y="4" width="10" height="10" rx="2" fill="url(#ta-credit)"></rect>
            <text class="tax-assessment__svg-label" x="${CHART.labelWidth + 84}" y="10" dominant-baseline="middle">Crédito</text>
          </g>
          ${bars}
          ${deductionBlock}
        </svg>
      </div>
    `;
}


// ======================================================================
// CRÉDITOS POR ORIGEM
// ======================================================================

function renderCredits(card, origins) {
    const container = card.querySelector('[data-ta-list="credits"]');
    if (!container) return;

    if (!origins.length) {
        container.innerHTML = '<div class="analytics-abc-ranking__empty">Sem créditos no período.</div>';
        return;
    }

    const total = origins.reduce((sum, origin) => sum + Number(origin.value || 0), 0);
    const maxValue = Math.max(...origins.map((origin) => Number(origin.value || 0)), 1);

    container.innerHTML = `
      <div class="analytics-abc-ranking">
        ${origins.map((origin) => {
        const value = Number(origin.value || 0);
        const share = total > 0 ? (value / total) * 100 : 0;
        const title = `${origin.label} — ${moneyBR(value)}` +
            (origin.estimated ? ' — calculado pela alíquota do regime (crédito não cumulativo)' : '');

        return `
              <div class="analytics-abc-ranking__row${origin.estimated ? ' tax-assessment__row--estimated' : ''}" title="${escapeHtml(title)}">
                <div class="analytics-abc-ranking__head">
                  <span class="analytics-abc-ranking__name">${escapeHtml(origin.label)}</span>
                  <span class="analytics-abc-ranking__value">${moneyBR(value)}</span>
                  <span class="analytics-abc-ranking__class analytics-abc-ranking__class--b sales-taxes__rate">${formatPercentage(share)}</span>
                </div>
                <div class="analytics-abc-ranking__track" aria-hidden="true">
                  <span class="analytics-abc-ranking__bar analytics-abc-ranking__bar--b" style="width:${barWidth(value, maxValue)}%"></span>
                </div>
              </div>
            `;
    }).join('')}
      </div>
    `;
}


// ======================================================================
// RESULTADO ESTIMADO (IRPJ / CSLL)
// ======================================================================

function renderResult(card, result, rows, regime) {
    const container = card.querySelector('[data-ta-list="result"]');
    if (!container) return;

    const irpj = rows.find((row) => row.key === 'irpj');
    const csll = rows.find((row) => row.key === 'csll');
    const das = rows.find((row) => row.key === 'das');

    const bySub = Array.isArray(result.deductionsBySubcategory) ? result.deductionsBySubcategory : [];

    const lines = result.basis === 'caixa'
        ? [
            { label: 'Receita das vendas', value: result.revenue },
            {
                label: '(−) Saídas dedutíveis no IRPJ/CSLL',
                value: -Number(result.deductions || 0),
                hint: 'Saídas do Caixa com "Dedutível no IRPJ/CSLL" marcado (na movimentação ou na subcategoria). Valor + juros + multa + encargos; na opção "Só juros, multas e encargos", sem o valor principal.',
            },
            ...bySub.slice(0, 4).map((sub) => ({ label: sub.label, value: -Number(sub.value || 0), sub: true })),
            { label: '= Lucro estimado', value: result.profit, strong: true },
        ]
        : [
            { label: 'Receita das vendas', value: result.revenue },
            { label: '(−) Custo das mercadorias vendidas', value: -Number(result.costOfGoods || 0), hint: 'Quantidade vendida × preço de custo do cadastro do produto' },
            { label: '(−) Despesas lançadas', value: -Number(result.expenses || 0) },
            { label: '= Lucro estimado', value: result.profit, strong: true },
        ];

    if (irpj) lines.push({ label: irpj.label, value: irpj.debit, tax: true });
    if (csll) lines.push({ label: csll.label, value: csll.debit, tax: true });
    if (das) lines.push({ label: das.label, value: das.debit, tax: true });

    const note = {
        presumido: 'IRPJ/CSLL pelo Lucro Presumido: calculados sobre a receita, não sobre o lucro.',
        lucro: result.basis === 'caixa'
            ? `IRPJ/CSLL pelo Lucro Real sobre o lucro acima. Saídas não dedutíveis fora da base: ${moneyBR(Number(result.nonDeductible || 0))}.`
            : 'IRPJ/CSLL pelo Lucro Real sobre o lucro estimado acima.',
        margem: 'IRPJ/CSLL pelo Lucro Real sobre a margem estimada do cadastro do regime.',
    }[result.method] || (
        ['SIMPLES', 'MEI'].includes(regime?.regime)
            ? 'No Simples o IRPJ e a CSLL estão dentro do DAS.'
            : regime ? 'Informe a margem estimada no Regime Tributário para estimar IRPJ/CSLL.'
                : 'Cadastre o Regime Tributário para estimar IRPJ e CSLL.'
    );

    container.innerHTML = `
      <div class="tax-assessment__result">
        ${lines.map((line) => `
          <div class="tax-assessment__result-line${line.strong ? ' is-strong' : ''}${line.tax ? ' is-tax' : ''}${line.sub ? ' is-sub' : ''}" ${line.hint ? `title="${escapeHtml(line.hint)}"` : ''}>
            <span>${escapeHtml(line.label)}</span>
            <strong>${moneyBR(Number(line.value || 0))}</strong>
          </div>
        `).join('')}
        <p class="tax-assessment__result-note">${escapeHtml(note)}</p>
      </div>
    `;
}


// ======================================================================
// PERIOD FILTER
// ======================================================================

function getCurrentMonthRange() {
    const today = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    const year = today.getFullYear();
    const month = today.getMonth() + 1;

    return {
        startDate: `${year}-${pad(month)}-01`,
        endDate: `${year}-${pad(month)}-${pad(today.getDate())}`,
    };
}


function bindPeriodFilter(card) {
    if (card.dataset.periodFilterBound === 'true') return;

    const mode = card.querySelector('[data-ta-filter="periodMode"]');
    const start = card.querySelector('[data-ta-filter="startDate"]');
    const end = card.querySelector('[data-ta-filter="endDate"]');
    const custom = card.querySelector('[data-ta-period-custom]');
    const apply = card.querySelector('[data-ta-action="applyPeriod"]');
    const currentMonth = getCurrentMonthRange();

    if (!mode || !start || !end || !custom || !apply) return;

    start.value = currentMonth.startDate;
    end.value = currentMonth.endDate;
    start.max = currentMonth.endDate;
    end.max = currentMonth.endDate;

    mode.addEventListener('change', async () => {
        const isCustom = mode.value === 'custom';
        custom.hidden = !isCustom;

        if (!isCustom) {
            const range = getCurrentMonthRange();
            start.value = range.startDate;
            end.value = range.endDate;
            await reload(card, apply);
        }
    });

    apply.addEventListener('click', async () => {
        if (!start.value || !end.value) {
            showCenterModal({ variant: 'warning', title: 'Período', message: 'Informe a data inicial e a data final.' });
            return;
        }

        if (start.value > end.value) {
            showCenterModal({ variant: 'warning', title: 'Período', message: 'A data inicial não pode ser maior que a data final.' });
            return;
        }

        await reload(card, apply);
    });

    card.dataset.periodFilterBound = 'true';
}


// ======================================================================
// EXPORT — MEMÓRIA DE CÁLCULO (EXCEL / PDF)
// ======================================================================

function bindExport(card) {
    if (card.dataset.exportBound === 'true') return;

    card.querySelectorAll('[data-ta-export]').forEach((button) => {
        button.addEventListener('click', () => downloadExport(card, button));
    });

    card.dataset.exportBound = 'true';
}


async function downloadExport(card, button) {
    const format = button.dataset.taExport;
    const label = button.textContent;
    const params = new URLSearchParams({ format });
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';

    if (card.dataset.taStartDate) params.set('startDate', card.dataset.taStartDate);
    if (card.dataset.taEndDate) params.set('endDate', card.dataset.taEndDate);

    button.disabled = true;
    button.textContent = 'Gerando...';

    try {
        const response = await fetch(`${ENDPOINT}/export?${params.toString()}`, {
            cache: 'no-store',
            credentials: 'same-origin',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!response.ok) {
            const body = await response.json().catch(() => null);
            throw new Error(body?.message || `HTTP ${response.status}`);
        }

        const disposition = response.headers.get('Content-Disposition') || '';
        const fileName = disposition.match(/filename="([^"]+)"/)?.[1] || `memoria_calculo_apuracao.${format}`;
        const url = URL.createObjectURL(await response.blob());
        const link = document.createElement('a');

        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
        console.error('[dashboard][tax-assessment] Failed to export:', error);
        showCenterModal({ variant: 'error', title: 'Erro', message: 'Não foi possível gerar a memória de cálculo.' });
    } finally {
        button.disabled = false;
        button.textContent = label;
    }
}


async function reload(card, button) {
    button.disabled = true;
    button.textContent = 'Carregando...';

    try {
        await loadAssessment(card);
    } catch (error) {
        console.error('[dashboard][tax-assessment] Failed to apply period:', error);
        showCenterModal({ variant: 'error', title: 'Erro', message: 'Não foi possível carregar o período selecionado.' });
    } finally {
        button.disabled = false;
        button.textContent = 'Aplicar';
    }
}


function buildEndpoint(card) {
    const start = card.querySelector('[data-ta-filter="startDate"]')?.value || '';
    const end = card.querySelector('[data-ta-filter="endDate"]')?.value || '';
    const params = new URLSearchParams();

    if (start) params.set('startDate', start);
    if (end) params.set('endDate', end);

    return `${ENDPOINT}?${params.toString()}`;
}


function updatePeriodCaption(card, filters = {}) {
    const caption = card.querySelector('[data-ta-period-caption]');
    if (!caption) return;

    const format = (value) => {
        if (!value) return '—';
        const [year, month, day] = String(value).split('-');
        return `${day}/${month}/${year}`;
    };

    caption.textContent = `${format(filters.startDate)} até ${format(filters.endDate)}`;
}


// ======================================================================
// FORMAT
// ======================================================================

function setText(card, field, value) {
    const element = card.querySelector(`[data-ta-field="${field}"]`);
    if (element) element.textContent = value;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function formatInteger(value) {
    return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatPercentage(value) {
    return `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Number(value || 0))}%`;
}

function shortLabel(label) {
    // "PIS (NÃO CUMULATIVO)" → "PIS" so the chart labels fit.
    return String(label || '').replace(/\s*\(.*\)\s*$/, '');
}

function truncateText(value, maxLength = 30) {
    const text = String(value || '');
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}
