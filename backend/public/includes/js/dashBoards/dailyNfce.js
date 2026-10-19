import { moneyBR, currentDateBR, fetchDashboard } from './dashboardUtils.js';

export const dailyNfceDashboard = {
  key: 'daily-nfce',
  render() {
    return `<article class="dash-card" data-dashboard-key="daily-nfce"><h3>NFC-e do Dia</h3><div class="dash-value" data-field="dailyNfceValue">R$ 0,00</div><footer><span data-label="dailyNfceInfo">Referente a — · 0 doc(s)</span></footer></article>`;
  },
  async load(root) {
    try {
      const data = await fetchDashboard('/api/dashboard/nfce-dia');
      const total = Number(data?.total ?? data?.valor ?? 0);
      const quantity = Number(data?.quantidade ?? data?.qtd ?? 0);
      const valueEl = root.querySelector('[data-field="dailyNfceValue"]');
      const infoEl = root.querySelector('[data-label="dailyNfceInfo"]');
      if (valueEl) valueEl.textContent = moneyBR(total);
      if (infoEl) infoEl.textContent = `Referente a ${currentDateBR()} · ${quantity} doc(s)`;
    } catch (error) { console.error('[dashboard][daily-nfce]', error); }
  }
};
