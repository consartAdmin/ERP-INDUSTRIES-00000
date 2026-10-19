import { moneyBR, currentMonthBR, fetchDashboard } from './dashboardUtils.js';
export const monthlyPayablesDashboard = {
  key:'monthly-payables',
  render(){return `<article class="dash-card" data-dashboard-key="monthly-payables"><h3>Total à Pagar Mês</h3><div class="dash-value" data-field="monthlyPayables">R$ 0,00</div><footer><span data-label="monthlyPayablesPeriod">—</span></footer></article>`;},
  async load(root){try{const data=await fetchDashboard('/api/dashboard/total-pagar-mes'); const el=root.querySelector('[data-field="monthlyPayables"]'); const info=root.querySelector('[data-label="monthlyPayablesPeriod"]'); if(el)el.textContent=moneyBR(data?.valor??data?.total??0); if(info)info.textContent=`Mês ${currentMonthBR()}`;}catch(error){console.error('[dashboard][monthly-payables]',error);}}
};
