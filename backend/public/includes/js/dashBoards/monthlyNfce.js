import { moneyBR, currentMonthBR, fetchDashboard } from './dashboardUtils.js';
export const monthlyNfceDashboard = {
  key:'monthly-nfce',
  render(){return `<article class="dash-card" data-dashboard-key="monthly-nfce"><h3>NFC-e Autorizadas</h3><div class="dash-value" data-field="monthlyNfceValue">R$ 0,00</div><footer><span data-label="monthlyNfceInfo">Mês —/— · 0 doc(s)</span></footer></article>`;},
  async load(root){try{const data=await fetchDashboard('/api/dashboard/nfce-mes'); const total=Number(data?.total??data?.valor??0); const quantity=Number(data?.quantidade??data?.qtd??0); const el=root.querySelector('[data-field="monthlyNfceValue"]'); const info=root.querySelector('[data-label="monthlyNfceInfo"]'); if(el)el.textContent=moneyBR(total); if(info)info.textContent=`Mês ${currentMonthBR()} · ${quantity} doc(s)`;}catch(error){console.error('[dashboard][monthly-nfce]',error);}}
};
