// ╔══════════════════════════════════════════════════════════════════════╗
// ║ salesTaxes.js — Dashboard: Impostos sobre Vendas                   ║
// ║ PRODNEX ERP                                                        ║
// ║                                                                      ║
// ║ ✅ Impostos por tipo (ICMS, ICMS-ST, FCP, PIS, COFINS, IS...)       ║
// ║ ✅ Impostos por produto                                             ║
// ║ ✅ Total de impostos e carga tributária sobre o faturamento         ║
// ║ ✅ Mesmo filtro de período do dashboard de Vendas                   ║
// ║                                                                      ║
// ║ Fonte: snapshot fiscal por item gravado na emissão da NF-e.         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
    moneyBR,
    fetchDashboard,
} from './dashboardUtils.js';


// ======================================================================
// CONFIG
// ======================================================================

const DASHBOARD_KEY =
    'sales-taxes';

const ENDPOINT =
    '/api/dashboard/sales-taxes';

const PRODUCT_RANKING_LIMIT =
    20;

const PIE_LIMIT =
    5;

const PRODUCT_LABEL_LENGTH =
    40;

// Same 520 × 260 view box as the Vendas pies so both slides size alike.
const PIE = Object.freeze({
    width: 520,
    height: 260,
    centerX: 260,
    centerY: 130,
    radius: 118,
});

const PIE_GRADIENTS = Object.freeze([
    ['#1d4ed8', '#60a5fa'],
    ['#0891b2', '#67e8f9'],
    ['#38bdf8', '#bae6fd'],
    ['#7e22ce', '#d8b4fe'],
    ['#27272a', '#71717a'],
]);


// ======================================================================
// DASHBOARD
// ======================================================================

export const salesTaxesDashboard = {

    key: DASHBOARD_KEY,


    // ==================================================================
    // RENDER
    // ==================================================================

    render() {

        return `
          <article
            class="dash-card dash-card--analytics dash-card--taxes"
            data-dashboard-key="${DASHBOARD_KEY}"
          >

            <div class="sales-analytics sales-taxes">

              <section class="sales-analytics__period" aria-label="Filtro por período">
                <label class="sales-analytics__period-field">
                  <span>Período</span>
                  <select data-tax-filter="periodMode">
                    <option value="current-month">Mês atual</option>
                    <option value="custom">Escolher período</option>
                  </select>
                </label>

                <div class="sales-analytics__custom-dates" data-tax-period-custom hidden>
                  <label class="sales-analytics__period-field">
                    <span>Data inicial</span>
                    <input type="date" data-tax-filter="startDate" />
                  </label>

                  <label class="sales-analytics__period-field">
                    <span>Data final</span>
                    <input type="date" data-tax-filter="endDate" />
                  </label>

                  <button type="button" class="sales-analytics__period-apply" data-tax-action="applyPeriod">
                    Aplicar
                  </button>
                </div>

                <span class="sales-taxes__coverage" data-tax-coverage></span>
                <span class="sales-taxes__regime" data-tax-regime></span>
                <span class="sales-analytics__period-caption" data-tax-period-caption></span>
              </section>


              <!-- ==================================================== -->
              <!-- TAX PANELS                                           -->
              <!-- ==================================================== -->

              <section class="sales-analytics__abc-row">

                <section class="analytics-chart analytics-chart--abc analytics-chart--ranking">
                  <header class="analytics-chart__header">
                    <h3>IMPOSTOS POR TIPO</h3>
                  </header>
                  <div
                    class="analytics-chart__body"
                    data-tax-list="byTax"
                    aria-label="Impostos por tipo"
                  ></div>
                </section>

                <section class="analytics-chart analytics-chart--abc">
                  <header class="analytics-chart__header">
                    <h3>GRÁFICO: IMPOSTOS</h3>
                  </header>
                  <div
                    class="analytics-chart__body analytics-product-pie-host"
                    data-tax-chart="byTaxPie"
                    role="img"
                    aria-label="Gráfico em pizza dos impostos por tipo"
                  ></div>
                </section>

                <section class="analytics-chart analytics-chart--abc analytics-chart--ranking">
                  <header class="analytics-chart__header">
                    <h3>IMPOSTOS POR PRODUTO</h3>
                  </header>
                  <div
                    class="analytics-chart__body"
                    data-tax-list="byProduct"
                    aria-label="Impostos por produto"
                  ></div>
                </section>

                <section class="analytics-chart analytics-chart--abc">
                  <header class="analytics-chart__header">
                    <h3>GRÁFICO: PRODUTOS</h3>
                  </header>
                  <div
                    class="analytics-chart__body analytics-product-pie-host"
                    data-tax-chart="byProductPie"
                    role="img"
                    aria-label="Gráfico em pizza dos impostos por produto"
                  ></div>
                </section>

              </section>


              <!-- ==================================================== -->
              <!-- KPI ROW                                              -->
              <!-- ==================================================== -->

              <section class="sales-analytics__kpi-row">

                <div class="analytics-kpi analytics-kpi--revenue kpi-w-20 kpi-h-2 kpi-p-1 kpi-radius-6">
                  <span class="analytics-kpi__label">TOTAL FATURAMENTO</span>
                  <strong class="analytics-kpi__value" data-tax-field="revenue">R$ 0,00</strong>
                </div>

                <div class="analytics-kpi analytics-kpi--taxes kpi-w-20 kpi-h-2 kpi-p-1 kpi-radius-6">
                  <span class="analytics-kpi__label">TOTAL IMPOSTOS</span>
                  <strong class="analytics-kpi__value" data-tax-field="totalTaxes">R$ 0,00</strong>
                </div>

                <div class="analytics-kpi analytics-kpi--invoices kpi-w-20 kpi-h-2 kpi-p-1 kpi-radius-6">
                  <span class="analytics-kpi__label">CARGA TRIBUTÁRIA SOBRE FATURAMENTO</span>
                  <strong class="analytics-kpi__value" data-tax-field="effectiveRate">0,00%</strong>
                </div>

                <div class="analytics-kpi analytics-kpi--ticket kpi-w-20 kpi-h-2 kpi-p-1 kpi-radius-6">
                  <span class="analytics-kpi__label">LÍQUIDO APÓS IMPOSTOS</span>
                  <strong class="analytics-kpi__value" data-tax-field="netAfterTaxes">R$ 0,00</strong>
                </div>

              </section>

            </div>

          </article>
        `;
    },


    // ==================================================================
    // LOAD
    // ==================================================================

    async load(root) {

        const card = getCard(root);
        if (!card) return;

        try {
            bindPeriodFilter(card);
            await loadSalesTaxes(card);
        } catch (error) {
            console.error('[dashboard][sales-taxes] Failed to load:', error);
            renderError(card);
        }
    },
};


// ======================================================================
// LOAD
// ======================================================================

function getCard(root) {
    return root.querySelector(`.dash-card[data-dashboard-key="${DASHBOARD_KEY}"]`);
}


async function loadSalesTaxes(card) {
    const data = await fetchDashboard(buildEndpoint(card));

    console.log('[dashboard][sales-taxes] Response:', data);

    const summary = data?.summary || {};

    updateSummary(card, summary);
    updateCoverage(card, summary, data?.sourcesAvailable !== false, data?.regime);
    updateRegime(card, data?.regime);

    const byTax = (Array.isArray(data?.byTax) ? data.byTax : [])
        .filter((tax) => Number(tax?.value || 0) > 0);

    renderTaxRanking(card, byTax);
    renderPie(
        card.querySelector('[data-tax-chart="byTaxPie"]'),
        byTax.filter((tax) => !tax.informative),
        'tax-type'
    );

    const byProduct = Array.isArray(data?.byProduct) ? data.byProduct : [];

    renderProductRanking(card, byProduct);
    renderPie(
        card.querySelector('[data-tax-chart="byProductPie"]'),
        byProduct,
        'tax-product'
    );

    updatePeriodCaption(card, data?.filters);
}


function renderError(card) {
    card.querySelectorAll('[data-tax-list], [data-tax-chart]').forEach((element) => {
        element.innerHTML =
            '<div class="analytics-abc-ranking__empty">Não foi possível carregar os impostos.</div>';
    });
}


// ======================================================================
// PERIOD FILTER
// ======================================================================

function getCurrentMonthRange() {
    const now = new Date();
    const year = now.getFullYear();
    const monthIndex = now.getMonth();
    const month = String(monthIndex + 1).padStart(2, '0');
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();

    return {
        startDate: `${year}-${month}-01`,
        endDate: `${year}-${month}-${String(lastDay).padStart(2, '0')}`,
    };
}


function bindPeriodFilter(card) {
    if (card.dataset.periodFilterBound === 'true') return;

    const mode = card.querySelector('[data-tax-filter="periodMode"]');
    const start = card.querySelector('[data-tax-filter="startDate"]');
    const end = card.querySelector('[data-tax-filter="endDate"]');
    const custom = card.querySelector('[data-tax-period-custom]');
    const apply = card.querySelector('[data-tax-action="applyPeriod"]');
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
            await reloadSalesTaxes(card, apply);
        }
    });

    apply.addEventListener('click', async () => {
        if (!start.value || !end.value) {
            window.alert('Informe a data inicial e a data final.');
            return;
        }

        if (start.value > end.value) {
            window.alert('A data inicial não pode ser maior que a data final.');
            return;
        }

        await reloadSalesTaxes(card, apply);
    });

    card.dataset.periodFilterBound = 'true';
}


async function reloadSalesTaxes(card, button) {
    button.disabled = true;
    button.textContent = 'Carregando...';

    try {
        await loadSalesTaxes(card);
    } catch (error) {
        console.error('[dashboard][sales-taxes] Failed to apply period:', error);
        window.alert('Não foi possível carregar o período selecionado.');
    } finally {
        button.disabled = false;
        button.textContent = 'Aplicar';
    }
}


function buildEndpoint(card) {
    const start = card.querySelector('[data-tax-filter="startDate"]')?.value || '';
    const end = card.querySelector('[data-tax-filter="endDate"]')?.value || '';
    const params = new URLSearchParams();

    if (start) params.set('startDate', start);
    if (end) params.set('endDate', end);

    return `${ENDPOINT}?${params.toString()}`;
}


function updatePeriodCaption(card, filters = {}) {
    const caption = card.querySelector('[data-tax-period-caption]');
    if (!caption) return;

    const format = (value) => {
        if (!value) return '—';
        const [year, month, day] = String(value).split('-');
        return `${day}/${month}/${year}`;
    };

    caption.textContent = `${format(filters.startDate)} até ${format(filters.endDate)}`;
}


// ======================================================================
// SUMMARY
// ======================================================================

function updateSummary(card, summary) {
    const revenue = Number(summary?.totalRevenue || 0);
    const coveredRevenue = Number(summary?.coveredRevenue || 0);
    const totalTaxes = Number(summary?.totalTaxes || 0);
    const effectiveRate = Number(summary?.effectiveRate || 0);

    setText(card, 'revenue', moneyBR(revenue));
    setText(card, 'totalTaxes', moneyBR(totalTaxes));
    setText(card, 'effectiveRate', formatPercentage(effectiveRate));
    setText(card, 'netAfterTaxes', moneyBR(
        summary?.netAfterTaxes != null ? Number(summary.netAfterTaxes) : coveredRevenue - totalTaxes
    ));
}


function updateRegime(card, regime) {
    const element = card.querySelector('[data-tax-regime]');
    if (!element) return;

    element.classList.toggle('sales-taxes__regime--missing', !regime);

    if (!regime) {
        element.textContent = 'Regime não cadastrado';
        element.title = 'Cadastre o Regime Tributário da empresa para estimar DAS, IRPJ e CSLL neste painel.';
        return;
    }

    element.textContent = regime.label;
    element.title = regime.summary || regime.label;
}


function updateCoverage(card, summary, sourcesAvailable, regime) {
    const element = card.querySelector('[data-tax-coverage]');
    if (!element) return;

    const total = Number(summary?.totalInvoices || 0);
    const covered = Number(summary?.coveredInvoices || 0);
    const missing = Math.max(0, total - covered);

    element.classList.toggle('sales-taxes__coverage--warning', missing > 0 || !sourcesAvailable);

    if (!sourcesAvailable) {
        element.textContent = 'Impostos não registrados nas notas emitidas';
        element.title = 'As tabelas de emissão de NF-e com os impostos por item não foram encontradas.';
        return;
    }

    if (!total) {
        element.textContent = 'Nenhuma nota no período';
        element.title = '';
        return;
    }

    const items = Number(summary?.items || 0);
    const itemsWithRates = Number(summary?.itemsWithRates || 0);

    // Simples/MEI notes carry no item rates by design: the DAS estimate covers them.
    const simplesLike = ['SIMPLES', 'MEI'].includes(regime?.regime);

    if (!simplesLike && covered > 0 && items > 0 && itemsWithRates === 0) {
        element.classList.add('sales-taxes__coverage--warning');
        element.textContent = 'Produtos sem alíquotas na emissão';
        element.title = 'As notas do período foram emitidas sem alíquotas de ICMS/PIS/COFINS. ' +
            'Configure o Perfil Fiscal e a Classificação Fiscal dos produtos (e o CRT da empresa) ' +
            'para que as próximas notas tragam os impostos.';
        return;
    }

    element.textContent = missing > 0
        ? `${formatInteger(covered)} de ${formatInteger(total)} notas com impostos`
        : `${formatInteger(total)} notas com impostos`;

    element.title = missing > 0
        ? `${formatInteger(missing)} nota(s) do período não têm os impostos gravados na emissão e ficaram fora do cálculo. ` +
        'Líquido e carga tributária consideram apenas as notas com impostos.'
        : 'Todas as notas do período têm os impostos gravados na emissão.';
}


function setText(card, field, value) {
    const element = card.querySelector(`[data-tax-field="${field}"]`);
    if (element) element.textContent = value;
}


// ======================================================================
// RANKINGS
// ======================================================================

function renderTaxRanking(card, items) {
    const container = card.querySelector('[data-tax-list="byTax"]');
    if (!container) return;

    if (!items.length) {
        container.innerHTML = '<div class="analytics-abc-ranking__empty">Sem impostos no período.</div>';
        return;
    }

    const maxValue = Math.max(...items.map((item) => Number(item.value || 0)), 1);

    container.innerHTML = `
      <div class="analytics-abc-ranking">
        ${items.map((item) => {
        const value = Number(item.value || 0);
        const width = Math.max(2, Math.min(100, (value / maxValue) * 100));
        const tone = item.informative ? 'c' : (item.estimated ? 'b' : 'a');
        const badge = formatPercentage(item.rateOverRevenue);
        const title = item.informative
            ? `${item.label} — ${moneyBR(value)} — informativo, não somado ao total`
            : `${item.label} — ${moneyBR(value)} — ${formatPercentage(item.percentage)} dos impostos — ${badge} do faturamento` +
            (item.estimated ? ' — estimado pelo Regime Tributário cadastrado' : '');

        return `
              <div class="analytics-abc-ranking__row${item.informative ? ' sales-taxes__row--informative' : ''}" title="${escapeHtml(title)}">
                <div class="analytics-abc-ranking__head">
                  <span class="analytics-abc-ranking__name">${escapeHtml(item.label)}</span>
                  <span class="analytics-abc-ranking__value">${moneyBR(value)}</span>
                  <span class="analytics-abc-ranking__class analytics-abc-ranking__class--${tone} sales-taxes__rate">${badge}</span>
                </div>
                <div class="analytics-abc-ranking__track" aria-hidden="true">
                  <span class="analytics-abc-ranking__bar analytics-abc-ranking__bar--${tone}" style="width:${width.toFixed(2)}%"></span>
                </div>
              </div>
            `;
    }).join('')}
      </div>
    `;
}


function renderProductRanking(card, items) {
    const container = card.querySelector('[data-tax-list="byProduct"]');
    if (!container) return;

    const visibleItems = items.slice(0, PRODUCT_RANKING_LIMIT);

    if (!visibleItems.length) {
        container.innerHTML = '<div class="analytics-abc-ranking__empty">Sem impostos no período.</div>';
        return;
    }

    const maxValue = Math.max(...visibleItems.map((item) => Number(item.value || 0)), 1);

    container.innerHTML = `
      <div class="analytics-abc-ranking">
        ${visibleItems.map((item) => {
        const value = Number(item.value || 0);
        const width = Math.max(2, Math.min(100, (value / maxValue) * 100));
        const rawClass = String(item.class || 'C').trim().toUpperCase();
        const abcClass = ['A', 'B', 'C'].includes(rawClass) ? rawClass : 'C';
        const rate = formatPercentage(item.effectiveRate);

        return `
              <div class="analytics-abc-ranking__row" title="${escapeHtml(item.label)} — impostos ${moneyBR(value)} sobre ${moneyBR(item.netTotal)} vendidos — carga ${rate}">
                <div class="analytics-abc-ranking__head">
                  <span class="analytics-abc-ranking__name">${escapeHtml(truncateText(item.label, PRODUCT_LABEL_LENGTH))}</span>
                  <span class="analytics-abc-ranking__value">${moneyBR(value)}</span>
                  <span class="analytics-abc-ranking__class analytics-abc-ranking__class--${abcClass.toLowerCase()} sales-taxes__rate">${rate}</span>
                </div>
                <div class="analytics-abc-ranking__track" aria-hidden="true">
                  <span class="analytics-abc-ranking__bar analytics-abc-ranking__bar--${abcClass.toLowerCase()}" style="width:${width.toFixed(2)}%"></span>
                </div>
              </div>
            `;
    }).join('')}
      </div>
    `;
}


// ======================================================================
// PIE (same exploded SVG pie as the Vendas dashboard)
// ======================================================================

function renderPie(container, items, gradientPrefix) {
    if (!container) return;

    const sorted = (Array.isArray(items) ? items : [])
        .filter((item) => Number(item?.value || 0) > 0)
        .sort((a, b) => Number(b.value) - Number(a.value));

    if (!sorted.length) {
        container.innerHTML = '<div class="analytics-product-pie__empty">Sem dados para exibir.</div>';
        return;
    }

    // Keep the pie readable: top slices plus one "OUTROS" slice.
    const visibleItems = sorted.slice(0, PIE_LIMIT);

    if (sorted.length > PIE_LIMIT) {
        const othersValue = sorted
            .slice(PIE_LIMIT - 1)
            .reduce((sum, item) => sum + Number(item.value || 0), 0);

        visibleItems.splice(PIE_LIMIT - 1, 1, { label: 'OUTROS', value: othersValue });
    }

    const total = visibleItems.reduce((sum, item) => sum + Number(item.value || 0), 0);

    const gradientDefinitions = PIE_GRADIENTS.map(([startColor, endColor], index) => `
      <linearGradient id="${gradientPrefix}-gradient-${index}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${startColor}"></stop>
        <stop offset="100%" stop-color="${endColor}"></stop>
      </linearGradient>
    `).join('');

    let startAngle = -90;

    const slices = visibleItems.map((item, index) => {
        const value = Number(item.value || 0);
        const percentage = total > 0 ? (value / total) * 100 : 0;
        const sweep = (percentage / 100) * 360;
        const endAngle = startAngle + sweep;
        const middleAngle = startAngle + (sweep / 2);
        const explode = polarPoint(5, middleAngle);
        const labelPoint = polarPoint(PIE.radius * 0.66, middleAngle);
        const path = describePieSlice(PIE.centerX, PIE.centerY, PIE.radius, startAngle, endAngle);

        startAngle = endAngle;

        return `
          <g class="analytics-product-pie__slice" transform="translate(${explode.x.toFixed(2)} ${explode.y.toFixed(2)})">
            <path d="${path}" fill="url(#${gradientPrefix}-gradient-${index % PIE_GRADIENTS.length})" stroke="#ffffff" stroke-width="2">
              <title>${escapeHtml(item.label)} — ${moneyBR(value)} — ${formatPercentage(percentage)}</title>
            </path>
            ${percentage >= 7 ? `
              <text
                x="${(PIE.centerX + labelPoint.x).toFixed(2)}"
                y="${(PIE.centerY + labelPoint.y).toFixed(2)}"
                text-anchor="middle"
                dominant-baseline="middle"
              >${Math.round(percentage)}%</text>
            ` : ''}
          </g>
        `;
    });

    container.innerHTML = `
      <div class="analytics-product-pie">
        <svg viewBox="0 0 ${PIE.width} ${PIE.height}" aria-hidden="true" focusable="false">
          <defs>${gradientDefinitions}</defs>
          ${slices.join('')}
        </svg>
      </div>
    `;
}


function polarPoint(radius, angleInDegrees) {
    const radians = (angleInDegrees - 90) * Math.PI / 180;
    return {
        x: radius * Math.cos(radians),
        y: radius * Math.sin(radians),
    };
}


function describePieSlice(centerX, centerY, radius, startAngle, endAngle) {
    if (endAngle - startAngle >= 359.999) {
        return [
            `M ${centerX} ${centerY - radius}`,
            `A ${radius} ${radius} 0 1 0 ${centerX} ${centerY + radius}`,
            `A ${radius} ${radius} 0 1 0 ${centerX} ${centerY - radius}`,
            'Z',
        ].join(' ');
    }

    const start = polarPoint(radius, endAngle);
    const end = polarPoint(radius, startAngle);
    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

    return [
        `M ${centerX} ${centerY}`,
        `L ${centerX + start.x} ${centerY + start.y}`,
        `A ${radius} ${radius} 0 ${largeArcFlag} 0 ${centerX + end.x} ${centerY + end.y}`,
        'Z',
    ].join(' ');
}


// ======================================================================
// FORMAT
// ======================================================================

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}


function formatInteger(value) {
    return Number(value || 0).toLocaleString('pt-BR', {
        maximumFractionDigits: 0,
    });
}


function formatPercentage(value) {
    return Number(value || 0).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }) + '%';
}


function truncateText(value, maxLength = 30) {
    const text = String(value || '');

    return text.length <= maxLength
        ? text
        : `${text.slice(0, maxLength - 1)}…`;
}
