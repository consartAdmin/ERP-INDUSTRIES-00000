// ╔══════════════════════════════════════════════════════════════════════╗
// ║ dailyReceivables.js — Dashboard: Daily Receivables                 ║
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
    'daily-receivables';

const ENDPOINT =
    '/api/dashboard/total-receber-dia';


// ======================================================================
// DASHBOARD
// ======================================================================

export const dailyReceivablesDashboard = {

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
          Total à Receber Dia
        </h3>

        <div
          class="dash-value"
          data-field="dailyReceivablesValue"
        >
          R$ 0,00
        </div>

        <footer>
          <span
            data-label="dailyReceivablesInfo"
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
                    '[data-field="dailyReceivablesValue"]'
                );


            const infoElement =
                root.querySelector(
                    '[data-label="dailyReceivablesInfo"]'
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
                '[dashboard][daily-receivables] Failed to load:',
                error
            );

        }
    },
};