// ╔══════════════════════════════════════════════════════════════════════╗
// ║ salesAnalytics.js — Dashboard: Sales Analytics                     ║
// ║ PRODNEX ERP                                                        ║
// ║                                                                      ║
// ║ ✅ Curva ABC: Produtos                                              ║
// ║ ✅ Curva ABC: Clientes                                              ║
// ║ ✅ Total Faturamento                                                ║
// ║ ✅ Quantidade Itens Vendidos                                        ║
// ║ ✅ Quantidade Notas Fiscais Emitidas                                ║
// ║ ✅ Ticket Médio                                                     ║
// ║ ✅ Chart.js                                                         ║
// ║ ✅ Compatible with dashboard permissions                            ║
// ║ ✅ Compatible with free dashboard layout                            ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
    moneyBR,
    fetchDashboard,
} from './dashboardUtils.js';


// ======================================================================
// CONFIG
// ======================================================================

const DASHBOARD_KEY =
    'sales-analytics';

const ENDPOINT =
    '/api/dashboard/sales-analytics';

// Show enough records for the accumulated curve to reach classes B and C.
const ABC_RANKING_LIMIT =
    20;

// Keep the pie charts compact and readable.
const ABC_PIE_LIMIT =
    5;

// Leader-line geometry inside the 520 × 260 SVG view box.
// Keeping labels inside these limits prevents clipping at panel edges.
const ABC_PIE_LINE = Object.freeze({
    viewBoxWidth: 520,
    viewBoxHeight: 260,
    centerX: 260,
    centerY: 130,
    radius: 118,
    bendRadiusOffset: 12,
    leftEndX: 178,
    leftTextX: 172,
    rightEndX: 342,
    rightTextX: 348,
    labelMaxLength: 25,
});

// The CSS grid still protects the monetary value and ABC badge columns.
// These limits only allow the name to use the full space up to those columns.
const ABC_RANKING_LABEL_LENGTH = Object.freeze({
    product: 45,
    customer: 42,
});


// ======================================================================
// CHART INSTANCES
// ======================================================================

let productsAbcChart =
    null;

let customersAbcChart =
    null;


// ======================================================================
// DASHBOARD
// ======================================================================

export const salesAnalyticsDashboard = {

    key: DASHBOARD_KEY,


    // ==================================================================
    // RENDER
    // ==================================================================

    render() {

        return `
          <article
            class="dash-card dash-card--analytics"
            data-dashboard-key="${DASHBOARD_KEY}"
          >

            <div
              class="
                sales-analytics
                sales-analytics-w-20
              "
            >

              <section class="sales-analytics__period" aria-label="Filtro por período">
                <label class="sales-analytics__period-field">
                  <span>Período</span>
                  <select data-filter="periodMode">
                    <option value="current-month">Mês atual</option>
                    <option value="custom">Escolher período</option>
                  </select>
                </label>

                <div class="sales-analytics__custom-dates" data-period-custom hidden>
                  <label class="sales-analytics__period-field">
                    <span>Data inicial</span>
                    <input type="date" data-filter="startDate" />
                  </label>

                  <label class="sales-analytics__period-field">
                    <span>Data final</span>
                    <input type="date" data-filter="endDate" />
                  </label>

                  <button type="button" class="sales-analytics__period-apply" data-action="applyPeriod">
                    Aplicar
                  </button>
                </div>

                <span class="sales-analytics__period-caption" data-period-caption></span>
              </section>

              <!-- ==================================================== -->
              <!-- ABC CHARTS                                           -->
              <!-- ==================================================== -->

              <section class="sales-analytics__abc-row">


                <!-- ================================================== -->
                <!-- ABC PRODUCTS — RANKING                             -->
                <!-- ================================================== -->

                <section
                  class="analytics-chart analytics-chart--abc analytics-chart--ranking"
                  data-analytics-panel="abc-products-ranking"
                >

                  <header class="analytics-chart__header">
                    <h3>CURVA ABC: PRODUTOS</h3>
                  </header>

                  <div
                    class="analytics-chart__body"
                    data-list="abcProducts"
                    aria-label="Ranking da Curva ABC de produtos"
                  ></div>

                </section>


                <!-- ================================================== -->
                <!-- ABC PRODUCTS — PARETO                              -->
                <!-- ================================================== -->

                <section
                  class="
                    analytics-chart
                    analytics-chart--abc
                    analytics-w-20
                    analytics-h-8
                  "
                  data-analytics-panel="abc-products"
                >

                  <header class="analytics-chart__header">

                    <h3>
                      GRÁFICO ABC: PRODUTOS
                    </h3>

                  </header>


                  <div
                    class="analytics-chart__body analytics-product-pie-host"
                    data-chart="abcProductsPie"
                    role="img"
                    aria-label="Gráfico em pizza da Curva ABC de produtos"
                  >
                  </div>

                </section>


                <!-- ================================================== -->
                <!-- ABC CUSTOMERS — RANKING                            -->
                <!-- ================================================== -->

                <section
                  class="
                    analytics-chart
                    analytics-chart--abc
                    analytics-chart--ranking
                    analytics-w-20
                    analytics-h-8
                  "
                  data-analytics-panel="abc-customers"
                >

                  <header class="analytics-chart__header">

                    <h3>
                      CURVA ABC: CLIENTES
                    </h3>

                  </header>


                  <div
                    class="analytics-chart__body"
                    data-list="abcCustomers"
                    aria-label="Ranking da Curva ABC de clientes"
                  >
                  </div>

                </section>


                <!-- ================================================== -->
                <!-- ABC CUSTOMERS — PIE                                -->
                <!-- ================================================== -->

                <section
                  class="analytics-chart analytics-chart--abc analytics-w-20 analytics-h-8"
                  data-analytics-panel="abc-customers-chart"
                >

                  <header class="analytics-chart__header">
                    <h3>GRÁFICO ABC: CLIENTES</h3>
                  </header>

                  <div
                    class="analytics-chart__body analytics-product-pie-host"
                    data-chart="abcCustomersPie"
                    role="img"
                    aria-label="Gráfico em pizza da Curva ABC de clientes"
                  ></div>

                </section>

              </section>


              <!-- ==================================================== -->
              <!-- KPI ROW                                              -->
              <!-- ==================================================== -->

              <section class="sales-analytics__kpi-row">


                <!-- ================================================== -->
                <!-- TOTAL REVENUE                                      -->
                <!-- ================================================== -->

                <div
                  class="
                    analytics-kpi
                    analytics-kpi--revenue
                    kpi-w-20
                    kpi-h-2
                    kpi-p-1
                    kpi-radius-6
                  "
                >

                  <span class="analytics-kpi__label">
                    TOTAL FATURAMENTO
                  </span>


                  <strong
                    class="analytics-kpi__value"
                    data-field="salesAnalyticsRevenue"
                  >
                    R$ 0,00
                  </strong>

                </div>


                <!-- ================================================== -->
                <!-- ITEMS SOLD                                         -->
                <!-- ================================================== -->

                <div
                  class="
                    analytics-kpi
                    analytics-kpi--items
                    kpi-w-20
                    kpi-h-2
                    kpi-p-1
                    kpi-radius-6
                  "
                >

                  <span class="analytics-kpi__label">
                    QUANTIDADE ITENS VENDIDOS
                  </span>


                  <strong
                    class="analytics-kpi__value"
                    data-field="salesAnalyticsUnits"
                  >
                    0
                  </strong>

                </div>


                <!-- ================================================== -->
                <!-- INVOICES ISSUED                                    -->
                <!-- ================================================== -->

                <div
                  class="
                    analytics-kpi
                    analytics-kpi--invoices
                    kpi-w-20
                    kpi-h-2
                    kpi-p-1
                    kpi-radius-6
                  "
                >

                  <span class="analytics-kpi__label">
                    QUANTIDADE NOTAS FISCAIS EMITIDAS
                  </span>


                  <strong
                    class="analytics-kpi__value"
                    data-field="salesAnalyticsInvoices"
                  >
                    0
                  </strong>

                </div>


                <!-- ================================================== -->
                <!-- AVERAGE TICKET                                     -->
                <!-- ================================================== -->

                <div
                  class="
                    analytics-kpi
                    analytics-kpi--ticket
                    kpi-w-20
                    kpi-h-2
                    kpi-p-1
                    kpi-radius-6
                  "
                >

                  <span class="analytics-kpi__label">
                    TICKET MÉDIO
                  </span>


                  <strong
                    class="analytics-kpi__value"
                    data-field="salesAnalyticsAverageTicket"
                  >
                    R$ 0,00
                  </strong>

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

        try {

            bindPeriodFilter(root);

            await loadSalesAnalytics(
                root
            );

        } catch (error) {

            console.error(
                '[dashboard][sales-analytics] Failed to load:',
                error
            );

        }
    },
};


// ======================================================================
// LOAD SALES ANALYTICS
// ======================================================================

async function loadSalesAnalytics(root) {
    const endpoint = buildAnalyticsEndpoint(root);
    const analyticsData =
        await fetchDashboard(
            endpoint
        );

    console.log(
        '[dashboard][sales-analytics] Analytics response:',
        analyticsData
    );

    updateSummary(
        root,
        analyticsData?.summary || {}
    );

    // ABC products continues using the analytics endpoint.
    renderProductsAbcChart(
        root,
        normalizeAbcData(
            analyticsData?.abcProducts ??
            analyticsData?.productsABC ??
            analyticsData?.curvaAbcProdutos ??
            [],
            { type: 'product' }
        )
    );

    // ABC customers continues using the analytics endpoint.
    renderCustomersAbcChart(
        root,
        normalizeAbcData(
            analyticsData?.abcCustomers ??
            analyticsData?.customersABC ??
            analyticsData?.curvaAbcClientes ??
            []
        )
    );

    updatePeriodCaption(root, analyticsData?.filters);
}


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


function bindPeriodFilter(root) {
    if (root.dataset.periodFilterBound === 'true') return;

    const mode = root.querySelector('[data-filter="periodMode"]');
    const start = root.querySelector('[data-filter="startDate"]');
    const end = root.querySelector('[data-filter="endDate"]');
    const custom = root.querySelector('[data-period-custom]');
    const apply = root.querySelector('[data-action="applyPeriod"]');
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
            await reloadSalesAnalytics(root, apply);
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

        await reloadSalesAnalytics(root, apply);
    });

    root.dataset.periodFilterBound = 'true';
}


async function reloadSalesAnalytics(root, button) {
    button.disabled = true;
    button.textContent = 'Carregando...';

    try {
        await loadSalesAnalytics(root);
    } catch (error) {
        console.error('[dashboard][sales-analytics] Failed to apply period:', error);
        window.alert('Não foi possível carregar o período selecionado.');
    } finally {
        button.disabled = false;
        button.textContent = 'Aplicar';
    }
}


function buildAnalyticsEndpoint(root) {
    const start = root.querySelector('[data-filter="startDate"]')?.value || '';
    const end = root.querySelector('[data-filter="endDate"]')?.value || '';
    const params = new URLSearchParams();

    if (start) params.set('startDate', start);
    if (end) params.set('endDate', end);

    return `${ENDPOINT}?${params.toString()}`;
}


function updatePeriodCaption(root, filters = {}) {
    const caption = root.querySelector('[data-period-caption]');
    if (!caption) return;

    const format = (value) => {
        if (!value) return '—';
        const [year, month, day] = String(value).split('-');
        return `${day}/${month}/${year}`;
    };

    caption.textContent = `${format(filters.startDate)} até ${format(filters.endDate)}`;
}

// ======================================================================
// UPDATE SUMMARY
// ======================================================================

function updateSummary(
    root,
    summary
) {

    // ------------------------------------------------------------------
    // VALUES
    // ------------------------------------------------------------------

    const revenue =
        Number(
            summary?.totalRevenue ??
            summary?.totalFaturado ??
            summary?.totalFaturamento ??
            0
        );


    const units =
        Number(
            summary?.totalUnits ??
            summary?.totalUnidades ??
            summary?.itemsSold ??
            summary?.itensVendidos ??
            0
        );


    const invoices =
        Number(
            summary?.totalInvoices ??
            summary?.totalNfe ??
            summary?.totalNfes ??
            summary?.invoicesIssued ??
            summary?.notasEmitidas ??
            summary?.quantidadeNotas ??
            0
        );


    const averageTicket =
        Number(
            summary?.averageTicket ??
            summary?.ticketMedio ??
            0
        );


    // ------------------------------------------------------------------
    // ELEMENTS
    // ------------------------------------------------------------------

    const revenueElement =
        root.querySelector(
            '[data-field="salesAnalyticsRevenue"]'
        );


    const unitsElement =
        root.querySelector(
            '[data-field="salesAnalyticsUnits"]'
        );


    const invoicesElement =
        root.querySelector(
            '[data-field="salesAnalyticsInvoices"]'
        );


    const averageTicketElement =
        root.querySelector(
            '[data-field="salesAnalyticsAverageTicket"]'
        );


    // ------------------------------------------------------------------
    // UPDATE
    // ------------------------------------------------------------------

    if (revenueElement) {

        revenueElement.textContent =
            moneyBR(
                revenue
            );
    }


    if (unitsElement) {

        unitsElement.textContent =
            formatInteger(
                units
            );
    }


    if (invoicesElement) {

        invoicesElement.textContent =
            formatInteger(
                invoices
            );
    }


    if (averageTicketElement) {

        averageTicketElement.textContent =
            moneyBR(
                averageTicket
            );
    }
}


// ======================================================================
// NORMALIZE ABC DATA
// ======================================================================

function normalizeAbcData(data, { type = 'customer' } = {}) {

    if (
        !Array.isArray(
            data
        )
    ) {
        return [];
    }


    return data.map(
        (item, index) => {

            const originalLabel =
                String(
                    item?.label ??
                    item?.name ??
                    item?.nome ??
                    item?.product ??
                    item?.produto ??
                    item?.customer ??
                    item?.cliente ??
                    `Item ${index + 1}`
                ).trim();

            const manufacturerRef =
                String(
                    item?.manufacturer_ref ??
                    item?.manufacturerRef ??
                    item?.manufacturer_reference ??
                    ''
                ).trim();

            const label =
                type === 'product' &&
                    manufacturerRef &&
                    !originalLabel.startsWith(`${manufacturerRef} -`)
                    ? `${manufacturerRef} - ${originalLabel}`
                    : originalLabel;

            return {

                label:
                    label,


                value:
                    Number(
                        item?.value ??
                        item?.total ??
                        item?.revenue ??
                        item?.faturamento ??
                        item?.valor ??
                        0
                    ),


                percentage:
                    Number(
                        item?.percentage ??
                        item?.percentual ??
                        item?.percent ??
                        0
                    ),


                accumulated:
                    Number(
                        item?.accumulated ??
                        item?.cumulative ??
                        item?.percentualAcumulado ??
                        item?.acumulado ??
                        0
                    ),


                class:
                    String(
                        item?.class ??
                        item?.classe ??
                        item?.abcClass ??
                        ''
                    ).toUpperCase(),

            };
        }
    );
}


// ======================================================================
// CHART.JS
// ======================================================================

function getChartJs() {

    const Chart =
        window.Chart ??
        globalThis.Chart ??
        null;


    if (
        typeof Chart !== 'function'
    ) {

        console.warn(
            '[dashboard][sales-analytics] Chart.js was not found. ' +
            'ABC fallback renderer will be used.'
        );

        return null;
    }


    return Chart;
}


// ======================================================================
// DESTROY CHART
// ======================================================================

function destroyChart(chart) {

    try {

        chart?.destroy?.();

    } catch (error) {

        console.warn(
            '[dashboard][sales-analytics] Failed to destroy chart:',
            error
        );

    }
}


// ======================================================================
// ABC PRODUCTS CHART
// ======================================================================

function renderProductsAbcChart(
    root,
    items
) {

    renderProductsAbcRanking(
        root,
        items
    );

    const pieHost =
        root.querySelector(
            '[data-chart="abcProductsPie"]'
        );


    if (!pieHost) {

        console.warn(
            '[sales-analytics] Products ABC pie container not found.'
        );

        return;
    }


    renderProductsAbcPie(
        pieHost,
        items
    );
}


// ======================================================================
// ABC PRODUCTS — NATIVE EXPLODED PIE (NO CHART.JS REQUIRED)
// ======================================================================

function renderProductsAbcPie(container, items) {

    const visibleItems =
        (Array.isArray(items) ? items : [])
            .filter((item) => Number(item?.value || 0) > 0)
            .slice(0, ABC_PIE_LIMIT);


    if (!visibleItems.length) {
        container.innerHTML =
            '<div class="analytics-product-pie__empty">Sem dados para exibir.</div>';
        return;
    }


    const total =
        visibleItems.reduce(
            (sum, item) => sum + Number(item.value || 0),
            0
        );


    const gradients = [
        ['#1d4ed8', '#60a5fa'],
        ['#0891b2', '#67e8f9'],
        ['#38bdf8', '#bae6fd'],
        ['#7e22ce', '#d8b4fe'],
        ['#27272a', '#71717a'],
    ];


    const gradientPrefix =
        container.dataset.chart === 'abcCustomersPie'
            ? 'abc-customer'
            : 'abc-product';


    const gradientDefinitions =
        gradients.map(
            ([startColor, endColor], index) => `
              <linearGradient
                id="${gradientPrefix}-gradient-${index}"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stop-color="${startColor}"></stop>
                <stop offset="100%" stop-color="${endColor}"></stop>
              </linearGradient>
            `
        ).join('');


    const centerX = ABC_PIE_LINE.centerX;
    const centerY = ABC_PIE_LINE.centerY;
    const radius = ABC_PIE_LINE.radius;
    let startAngle = -90;


    const chartParts = visibleItems.map((item, index) => {

        const value = Number(item.value || 0);
        const percentage = total > 0 ? (value / total) * 100 : 0;
        const sweep = (percentage / 100) * 360;
        const endAngle = startAngle + sweep;
        const middleAngle = startAngle + (sweep / 2);
        const explode = polarPoint(5, middleAngle);
        const percentagePoint = polarPoint(radius * 0.66, middleAngle);
        const lineStart = polarPoint(radius + 8, middleAngle);
        const lineBend = polarPoint(
            radius + ABC_PIE_LINE.bendRadiusOffset,
            middleAngle
        );
        const isRight = lineBend.x >= 0;
        const lineEndX = isRight
            ? ABC_PIE_LINE.rightEndX
            : ABC_PIE_LINE.leftEndX;
        const textX = isRight
            ? ABC_PIE_LINE.rightTextX
            : ABC_PIE_LINE.leftTextX;
        const textAnchor = isRight ? 'start' : 'end';
        const lineY = Math.max(
            18,
            Math.min(
                ABC_PIE_LINE.viewBoxHeight - 18,
                centerY + lineBend.y + explode.y
            )
        );
        const path = describePieSlice(centerX, centerY, radius, startAngle, endAngle);
        const gradientIndex = index % gradients.length;
        const color = gradients[gradientIndex][0];
        const sliceFill = `url(#${gradientPrefix}-gradient-${gradientIndex})`;

        startAngle = endAngle;

        const slice = `
          <g class="analytics-product-pie__slice" transform="translate(${explode.x.toFixed(2)} ${explode.y.toFixed(2)})">
            <path d="${path}" fill="${sliceFill}" stroke="#ffffff" stroke-width="2">
              <title>${escapeHtml(item.label)} — ${moneyBR(value)} — ${formatPercentage(percentage)}</title>
            </path>
            ${percentage >= 7 ? `
              <text
                x="${(centerX + percentagePoint.x).toFixed(2)}"
                y="${(centerY + percentagePoint.y).toFixed(2)}"
                text-anchor="middle"
                dominant-baseline="middle"
              >${Math.round(percentage)}%</text>
            ` : ''}
          </g>
        `;

        const leader = `
          <g class="analytics-product-pie__leader">
            <polyline
              points="${(centerX + lineStart.x + explode.x).toFixed(2)},${(centerY + lineStart.y + explode.y).toFixed(2)} ${(centerX + lineBend.x + explode.x).toFixed(2)},${lineY.toFixed(2)} ${lineEndX},${lineY.toFixed(2)}"
            ></polyline>
            <circle cx="${lineEndX}" cy="${lineY.toFixed(2)}" r="2.2" fill="${color}"></circle>
            <text
              x="${textX}"
              y="${lineY.toFixed(2)}"
              text-anchor="${textAnchor}"
              dominant-baseline="middle"
            >${escapeHtml(truncateText(item.label, ABC_PIE_LINE.labelMaxLength))}</text>
          </g>
        `;

        return { slice, leader };
    });


    container.innerHTML = `
      <div class="analytics-product-pie">
        <svg
          viewBox="0 0 ${ABC_PIE_LINE.viewBoxWidth} ${ABC_PIE_LINE.viewBoxHeight}"
          aria-hidden="true"
          focusable="false"
        >
          <defs>${gradientDefinitions}</defs>
          ${chartParts.map((part) => part.slice).join('')}
          ${chartParts.map((part) => part.leader).join('')}
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
// ABC CUSTOMERS CHART
// ======================================================================

function renderCustomersAbcChart(
    root,
    items
) {

    renderCustomersAbcRanking(
        root,
        items
    );


    const pieHost =
        root.querySelector(
            '[data-chart="abcCustomersPie"]'
        );


    if (!pieHost) {

        console.warn(
            '[sales-analytics] Customers ABC pie container not found.'
        );

        return;
    }


    renderProductsAbcPie(
        pieHost,
        items
    );
}


// ======================================================================
// CREATE ABC CHART
// ======================================================================

function createAbcChart(
    canvas,
    items,
    datasetLabel
) {

    const Chart =
        getChartJs();


    if (!Chart) {
        return null;
    }


    if (
        !Array.isArray(items) ||
        !items.length
    ) {

        console.warn(
            `[sales-analytics] No ABC data for "${datasetLabel}".`,
            items
        );

        return null;
    }


    const visibleItems =
        items.slice(
            0,
            15
        );


    console.log(
        `[sales-analytics] Rendering "${datasetLabel}":`,
        visibleItems
    );


    const labels =
        visibleItems.map(
            (item) =>
                truncateText(
                    item.label,
                    24
                )
        );


    const values =
        visibleItems.map(
            (item) =>
                Number(
                    item.value ||
                    0
                )
        );


    const accumulated =
        visibleItems.map(
            (item) =>
                Number(
                    item.accumulated ||
                    0
                )
        );


    const barColors =
        visibleItems.map(
            (item) => {

                const abcClass =
                    String(
                        item.class ||
                        ''
                    )
                        .trim()
                        .toUpperCase();


                if (abcClass === 'A') {
                    return 'rgba(37, 99, 235, 0.78)';
                }


                if (abcClass === 'B') {
                    return 'rgba(14, 165, 233, 0.72)';
                }


                return 'rgba(148, 163, 184, 0.72)';
            }
        );


    try {

        return new Chart(
            canvas,
            {
                type:
                    'bar',

                data: {

                    labels,

                    datasets: [
                        {
                            type:
                                'bar',

                            label:
                                datasetLabel,

                            data:
                                values,

                            yAxisID:
                                'yRevenue',

                            backgroundColor:
                                barColors,

                            borderWidth:
                                0,

                            borderRadius:
                                4,

                            borderSkipped:
                                false,

                            barPercentage:
                                0.72,

                            categoryPercentage:
                                0.82,
                        },

                        {
                            type:
                                'line',

                            label:
                                '% Acumulado',

                            data:
                                accumulated,

                            yAxisID:
                                'yPercentage',

                            borderColor:
                                '#06b6d4',

                            backgroundColor:
                                '#06b6d4',

                            borderWidth:
                                2,

                            tension:
                                0.22,

                            pointRadius:
                                1.8,

                            pointHoverRadius:
                                4,

                            fill:
                                false,
                        },
                    ],
                },

                options: {

                    responsive:
                        true,

                    maintainAspectRatio:
                        false,

                    resizeDelay:
                        80,

                    animation: {

                        duration:
                            350,
                    },

                    interaction: {

                        mode:
                            'index',

                        intersect:
                            false,
                    },

                    plugins: {

                        legend: {

                            display:
                                false,
                        },

                        tooltip: {

                            callbacks: {

                                title(context) {

                                    const index =
                                        context?.[0]?.dataIndex ??
                                        0;


                                    return (
                                        visibleItems[index]?.label ||
                                        ''
                                    );
                                },

                                label(context) {

                                    const item =
                                        visibleItems[
                                        context.dataIndex
                                        ];


                                    if (!item) {
                                        return '';
                                    }


                                    if (
                                        context.dataset.yAxisID ===
                                        'yPercentage'
                                    ) {

                                        return (
                                            `Acumulado: ` +
                                            formatPercentage(
                                                item.accumulated
                                            )
                                        );
                                    }


                                    return (
                                        `${datasetLabel}: ` +
                                        moneyBR(
                                            Number(
                                                item.value ||
                                                0
                                            )
                                        )
                                    );
                                },

                                afterLabel(context) {

                                    if (
                                        context.dataset.yAxisID ===
                                        'yPercentage'
                                    ) {
                                        return '';
                                    }


                                    const item =
                                        visibleItems[
                                        context.dataIndex
                                        ];


                                    return [
                                        `Participação: ${formatPercentage(
                                            item?.percentage
                                        )}`,
                                        `Classe ABC: ${item?.class || '—'}`,
                                    ];
                                },
                            },
                        },
                    },

                    scales: {

                        x: {

                            ticks: {

                                color:
                                    '#64748b',

                                maxRotation:
                                    50,

                                minRotation:
                                    35,

                                autoSkip:
                                    false,

                                font: {

                                    size:
                                        8,
                                },
                            },

                            grid: {

                                display:
                                    false,
                            },

                            border: {

                                color:
                                    '#dbe5f1',
                            },
                        },

                        yRevenue: {

                            position:
                                'left',

                            beginAtZero:
                                true,

                            ticks: {

                                color:
                                    '#64748b',

                                maxTicksLimit:
                                    4,

                                font: {

                                    size:
                                        8,
                                },

                                callback(value) {

                                    return compactMoney(
                                        value
                                    );
                                },
                            },

                            grid: {

                                color:
                                    'rgba(148, 163, 184, 0.14)',
                            },

                            border: {

                                display:
                                    false,
                            },
                        },

                        yPercentage: {

                            position:
                                'right',

                            min:
                                0,

                            max:
                                100,

                            ticks: {

                                display:
                                    false,
                            },

                            grid: {

                                drawOnChartArea:
                                    false,
                            },

                            border: {

                                display:
                                    false,
                            },
                        },
                    },
                },
            }
        );

    } catch (error) {

        console.error(
            `[sales-analytics] Failed to create ABC chart "${datasetLabel}":`,
            error
        );

        return null;
    }
}


// ======================================================================
// FALLBACK ABC RENDERER
// ======================================================================

function renderAbcFallback(
    canvas,
    items,
    type = 'product'
) {

    const body =
        canvas?.parentElement;


    if (!body) {
        return;
    }


    body
        .querySelectorAll(
            '.analytics-abc-fallback'
        )
        .forEach(
            (element) =>
                element.remove()
        );


    canvas.style.display =
        'none';


    const visibleItems =
        Array.isArray(items)
            ? items.slice(0, ABC_RANKING_LIMIT)
            : [];


    const wrapper =
        document.createElement(
            'div'
        );


    wrapper.className =
        'analytics-abc-fallback';


    if (!visibleItems.length) {

        wrapper.innerHTML =
            '<div class="analytics-abc-fallback__empty">Sem dados para exibir.</div>';

        body.appendChild(
            wrapper
        );

        return;
    }


    const maxValue =
        Math.max(
            ...visibleItems.map(
                (item) =>
                    Number(
                        item.value ||
                        0
                    )
            ),
            1
        );


    wrapper.innerHTML =
        visibleItems
            .map(
                (item) => {

                    const value =
                        Number(
                            item.value ||
                            0
                        );


                    const width =
                        Math.max(
                            2,
                            Math.min(
                                100,
                                (
                                    value /
                                    maxValue
                                ) * 100
                            )
                        );


                    const abcClass =
                        String(
                            item.class ||
                            'C'
                        )
                            .trim()
                            .toUpperCase();


                    return `
                      <div class="analytics-abc-fallback__row">
                        <div class="analytics-abc-fallback__head">
                          <span class="analytics-abc-fallback__name">
                            ${escapeHtml(
                        truncateText(
                            item.label,
                            type === 'customer'
                                ? 34
                                : 30
                        )
                    )}
                          </span>

                          <span class="analytics-abc-fallback__class analytics-abc-fallback__class--${abcClass.toLowerCase()}">
                            ${escapeHtml(abcClass)}
                          </span>
                        </div>

                        <div class="analytics-abc-fallback__track">
                          <span
                            class="analytics-abc-fallback__bar analytics-abc-fallback__bar--${abcClass.toLowerCase()}"
                            style="width:${width.toFixed(2)}%"
                          ></span>
                        </div>
                      </div>
                    `;
                }
            )
            .join('');


    body.appendChild(
        wrapper
    );
}


// ======================================================================
// ESCAPE HTML
// ======================================================================

function escapeHtml(value) {

    return String(
        value ??
        ''
    )
        .replaceAll(
            '&',
            '&amp;'
        )
        .replaceAll(
            '<',
            '&lt;'
        )
        .replaceAll(
            '>',
            '&gt;'
        )
        .replaceAll(
            '"',
            '&quot;'
        )
        .replaceAll(
            "'",
            '&#039;'
        );
}


// ======================================================================
// FORMAT INTEGER
// ======================================================================

function formatInteger(value) {

    return Number(
        value || 0
    ).toLocaleString(
        'pt-BR',
        {
            maximumFractionDigits:
                0,
        }
    );
}


// ======================================================================
// FORMAT PERCENTAGE
// ======================================================================

function formatPercentage(value) {

    return Number(
        value || 0
    ).toLocaleString(
        'pt-BR',
        {
            minimumFractionDigits:
                1,

            maximumFractionDigits:
                2,
        }
    ) + '%';
}


// ======================================================================
// TRUNCATE TEXT
// ======================================================================

function truncateText(
    value,
    maxLength = 30
) {

    const text =
        String(
            value ||
            ''
        );


    if (
        text.length <=
        maxLength
    ) {
        return text;
    }


    return (
        text.slice(
            0,
            maxLength - 1
        ) +
        '…'
    );
}


// ======================================================================
// COMPACT MONEY
// ======================================================================

function compactMoney(value) {

    const number =
        Number(
            value || 0
        );


    if (
        Math.abs(number) >=
        1000000
    ) {

        return (
            `R$ ${(number / 1000000)
                .toFixed(1)
                .replace('.', ',')} mi`
        );
    }


    if (
        Math.abs(number) >=
        1000
    ) {

        return (
            `R$ ${(number / 1000)
                .toFixed(1)
                .replace('.', ',')} mil`
        );
    }


    return (
        `R$ ${number
            .toFixed(0)
            .replace('.', ',')}`
    );
}


// ======================================================================
// ABC PRODUCTS RANKING
// ======================================================================

function renderProductsAbcRanking(root, items) {

    const container =
        root.querySelector(
            '[data-list="abcProducts"]'
        );


    if (!container) {
        return;
    }


    const visibleItems =
        Array.isArray(items)
            ? items.slice(0, ABC_RANKING_LIMIT)
            : [];


    if (!visibleItems.length) {

        container.innerHTML =
            '<div class="analytics-abc-ranking__empty">Sem dados para exibir.</div>';

        return;
    }


    const maxValue =
        Math.max(
            ...visibleItems.map(
                (item) => Number(item?.value || 0)
            ),
            1
        );


    container.innerHTML = `
      <div class="analytics-abc-ranking">
        ${visibleItems.map((item) => {

        const value = Number(item?.value || 0);
        const width = Math.max(2, Math.min(100, (value / maxValue) * 100));
        const rawClass = String(item?.class || 'C').trim().toUpperCase();
        const abcClass = ['A', 'B', 'C'].includes(rawClass) ? rawClass : 'C';

        return `
              <div class="analytics-abc-ranking__row" title="${escapeHtml(item?.label)} — ${moneyBR(value)}">
                <div class="analytics-abc-ranking__head">
                  <span class="analytics-abc-ranking__name">${escapeHtml(truncateText(item?.label, ABC_RANKING_LABEL_LENGTH.product))}</span>
                  <span class="analytics-abc-ranking__value">${moneyBR(value)}</span>
                  <span class="analytics-abc-ranking__class analytics-abc-ranking__class--${abcClass.toLowerCase()}">${abcClass}</span>
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
// ABC CUSTOMERS RANKING
// ======================================================================

function renderCustomersAbcRanking(root, items) {

    const container =
        root.querySelector(
            '[data-list="abcCustomers"]'
        );


    if (!container) {
        return;
    }


    const visibleItems =
        Array.isArray(items)
            ? items.slice(0, ABC_RANKING_LIMIT)
            : [];


    if (!visibleItems.length) {
        container.innerHTML =
            '<div class="analytics-abc-ranking__empty">Sem dados para exibir.</div>';
        return;
    }


    const maxValue =
        Math.max(
            ...visibleItems.map((item) => Number(item?.value || 0)),
            1
        );


    container.innerHTML = `
      <div class="analytics-abc-ranking">
        ${visibleItems.map((item) => {

        const value = Number(item?.value || 0);
        const width = Math.max(2, Math.min(100, (value / maxValue) * 100));
        const rawClass = String(item?.class || 'C').trim().toUpperCase();
        const abcClass = ['A', 'B', 'C'].includes(rawClass) ? rawClass : 'C';

        return `
              <div class="analytics-abc-ranking__row" title="${escapeHtml(item?.label)} — ${moneyBR(value)}">
                <div class="analytics-abc-ranking__head">
                  <span class="analytics-abc-ranking__name">${escapeHtml(truncateText(item?.label, ABC_RANKING_LABEL_LENGTH.customer))}</span>
                  <span class="analytics-abc-ranking__value">${moneyBR(value)}</span>
                  <span class="analytics-abc-ranking__class analytics-abc-ranking__class--${abcClass.toLowerCase()}">${abcClass}</span>
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
