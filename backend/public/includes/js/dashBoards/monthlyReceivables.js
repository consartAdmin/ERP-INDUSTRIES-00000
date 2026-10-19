import { moneyBR, currentMonthBR, fetchDashboard } from './dashboardUtils.js';
export const monthlyReceivablesDashboard = {
  key:'monthly-receivables',
  render(){return `<article class="dash-card" data-dashboard-key="monthly-receivables"><h3>Total à Receber Mês</h3><div class="dash-value" data-field="monthlyReceivables">R$ 0,00</div><footer><span data-label="monthlyReceivablesPeriod">—</span></footer></article>`;},
  async load(root){try{const data=await fetchDashboard('/api/dashboard/total-receber-mes'); const el=root.querySelector('[data-field="monthlyReceivables"]'); const info=root.querySelector('[data-label="monthlyReceivablesPeriod"]'); if(el)el.textContent=moneyBR(data?.valor??data?.total??0); if(info)info.textContent=`Mês ${currentMonthBR()}`;}catch(error){console.error('[dashboard][monthly-receivables]',error);}}
};
