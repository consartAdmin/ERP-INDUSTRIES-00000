import { loadFinancialFlow, renderFinancialChart } from './financialChartUtils.js';

const DASHBOARD_KEY = 'receivables-chart';

export const receivablesChartDashboard = {
  key: DASHBOARD_KEY,

  render() {
    return `
      <article class="dash-card dash-card--financial-chart" data-dashboard-key="${DASHBOARD_KEY}">
        <header class="financial-chart__header">
          <h3>CONTAS A RECEBER</h3>
          <span data-financial-period>Carregando período...</span>
        </header>
        <div class="financial-chart__body" data-chart="receivables"></div>
      </article>
    `;
  },

  async load(root) {
    const data = await loadFinancialFlow();
    const card = root.querySelector(`[data-dashboard-key="${DASHBOARD_KEY}"]`);
    renderFinancialChart(card?.querySelector('[data-chart="receivables"]'), data?.receivables, {
      id: 'receivables',
      ariaLabel: 'Valores previstos e recebidos por dia',
      expected: { label: 'Previsto', color: '#2563eb' },
      settled: { label: 'Recebido', color: '#10b981' },
    });
    const period = card?.querySelector('[data-financial-period]');
    if (period) period.textContent = `${formatPeriodDate(data?.period?.startDate)} até ${formatPeriodDate(data?.period?.endDate)}`;
  },
};

export default receivablesChartDashboard;

function formatPeriodDate(value) {
  const [year, month, day] = String(value || '').split('-');
  return day && month ? `${day}/${month}/${year}` : '—';
}
