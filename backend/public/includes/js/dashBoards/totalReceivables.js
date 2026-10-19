import { moneyBR, fetchDashboard } from './dashboardUtils.js';

const DASHBOARD_KEY = 'total-receivables';
const ENDPOINT = '/api/dashboard/total-receber';

export const totalReceivablesDashboard = {
    key: DASHBOARD_KEY,
    render() {
        return `<article class="dash-card" data-dashboard-key="${DASHBOARD_KEY}">
      <h3>Total à Receber</h3>
      <div class="dash-value" data-field="totalReceivablesValue">R$ 0,00</div>
      <footer><span data-label="totalReceivablesInfo">0 título(s) em aberto</span></footer>
    </article>`;
    },
    async load(root) {
        try {
            const data = await fetchDashboard(ENDPOINT);
            const card = root.querySelector(`[data-dashboard-key="${DASHBOARD_KEY}"]`);
            const value = card?.querySelector('[data-field="totalReceivablesValue"]');
            const info = card?.querySelector('[data-label="totalReceivablesInfo"]');
            if (value) value.textContent = moneyBR(Number(data?.valor ?? data?.total ?? 0));
            if (info) info.textContent = `${Number(data?.quantidade ?? 0)} título(s) em aberto`;
        } catch (error) {
            console.error('[dashboard][total-receivables] Failed to load:', error);
        }
    },
};

export default totalReceivablesDashboard;
