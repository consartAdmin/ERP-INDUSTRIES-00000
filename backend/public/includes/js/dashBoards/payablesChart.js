import { loadFinancialFlow, renderFinancialChart } from './financialChartUtils.js';

const DASHBOARD_KEY = 'payables-chart';

export const payablesChartDashboard = {
  key: DASHBOARD_KEY,

  render() {
    return `
      <article class="dash-card dash-card--financial-chart" data-dashboard-key="${DASHBOARD_KEY}">
        <header class="financial-chart__header">
          <h3>CONTAS A PAGAR</h3>
          <span data-financial-period>Carregando período...</span>
        </header>
        <div class="financial-chart__body" data-chart="payables"></div>
      </article>
    `;
  },

  async load(root) {
    const data = await loadFinancialFlow();
    const card = root.querySelector(`[data-dashboard-key="${DASHBOARD_KEY}"]`);
    renderFinancialChart(card?.querySelector('[data-chart="payables"]'), data?.payables, {
      id: 'payables',
      ariaLabel: 'Valores previstos e pagos por dia',
      expected: { label: 'Previsto', color: '#f97316' },
      settled: { label: 'Pago', color: '#ef4444' },
    });
    const period = card?.querySelector('[data-financial-period]');
    if (period) period.textContent = `${formatPeriodDate(data?.period?.startDate)} até ${formatPeriodDate(data?.period?.endDate)}`;
  },
};

export default payablesChartDashboard;

function formatPeriodDate(value) {
  const [year, month, day] = String(value || '').split('-');
  return day && month ? `${day}/${month}/${year}` : '—';
}
