// ╔══════════════════════════════════════════════════════════════════════╗
// ║ dailyPayables.js — Dashboard: Daily Payables                       ║
// ║ PRODNEX ERP                                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
    moneyBR,
    fetchDashboard,
} from './dashboardUtils.js';


// ======================================================================
// CONFIG
// ======================================================================

const DASHBOARD_KEY =
    'daily-payables';

const ENDPOINT =
    '/api/dashboard/total-pagar-dia';


// ======================================================================
// DASHBOARD
// ======================================================================

export const dailyPayablesDashboard = {

    key: DASHBOARD_KEY,


    // ====================================================================
    // RENDER
    // ====================================================================

    render() {
        return `
      <article
        class="dash-card"
        data-dashboard-key="${DASHBOARD_KEY}"
      >

        <h3>
          Total à Pagar Dia
        </h3>

        <div
          class="dash-value"
          data-field="dailyPayablesValue"
        >
          R$ 0,00
        </div>

        <footer>
          <span
            data-label="dailyPayablesInfo"
          >
            Referente a —
          </span>
        </footer>

      </article>
    `;
    },


    // ====================================================================
    // LOAD
    // ====================================================================

    async load(root) {
        try {

            const data =
                await fetchDashboard(
                    ENDPOINT
                );


            const total =
                Number(
                    data?.valor ??
                    data?.total ??
                    0
                );


            const valueElement =
                root.querySelector(
                    '[data-field="dailyPayablesValue"]'
                );


            const infoElement =
                root.querySelector(
                    '[data-label="dailyPayablesInfo"]'
                );


            if (valueElement) {
                valueElement.textContent =
                    moneyBR(total);
            }


            if (infoElement) {
                infoElement.textContent =
                    `Referente a ${new Date().toLocaleDateString('pt-BR')}`;
            }


        } catch (error) {

            console.error(
                '[dashboard][daily-payables] Failed to load:',
                error
            );

        }
    },
};