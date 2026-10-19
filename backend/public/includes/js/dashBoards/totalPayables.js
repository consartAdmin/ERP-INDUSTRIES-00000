import { moneyBR, fetchDashboard } from './dashboardUtils.js';

const DASHBOARD_KEY = 'total-payables';
const ENDPOINT = '/api/dashboard/total-pagar';

export const totalPayablesDashboard = {
  key: DASHBOARD_KEY,
  render() {
    return `<article class="dash-card" data-dashboard-key="${DASHBOARD_KEY}">
      <h3>Total à Pagar</h3>
      <div class="dash-value" data-field="totalPayablesValue">R$ 0,00</div>
      <footer><span data-label="totalPayablesInfo">0 título(s) em aberto</span></footer>
    </article>`;
  },
  async load(root) {
    try {
      const data = await fetchDashboard(ENDPOINT);
      const card = root.querySelector(`[data-dashboard-key="${DASHBOARD_KEY}"]`);
      const value = card?.querySelector('[data-field="totalPayablesValue"]');
      const info = card?.querySelector('[data-label="totalPayablesInfo"]');
      if (value) value.textContent = moneyBR(Number(data?.valor ?? data?.total ?? 0));
      if (info) info.textContent = `${Number(data?.quantidade ?? 0)} título(s) em aberto`;
    } catch (error) {
      console.error('[dashboard][total-payables] Failed to load:', error);
    }
  },
};

export default totalPayablesDashboard;
