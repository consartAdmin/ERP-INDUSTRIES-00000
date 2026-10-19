// ╔══════════════════════════════════════════════════════════════════════╗
// ║ customerOverdue.js — Dashboard: Customer Overdue                   ║
// ║ PRODNEX ERP                                                        ║
// ║                                                                      ║
// ║ ✅ Shows total overdue customer receivables                          ║
// ║ ✅ Shows number of overdue/open titles                               ║
// ║ ✅ Uses dashboard shared utilities                                   ║
// ║ ✅ Includes tooltip information                                      ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  moneyBR,
  fetchDashboard,
} from './dashboardUtils.js';


// ======================================================================
// CONFIG
// ======================================================================

const DASHBOARD_KEY =
  'customer-overdue';

const ENDPOINT =
  '/api/dashboard/inadimplencia';


// ======================================================================
// DASHBOARD
// ======================================================================

export const customerOverdueDashboard = {

  // --------------------------------------------------------------------
  // DASHBOARD KEY
  // --------------------------------------------------------------------

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

        <!-- ========================================================== -->
        <!-- TITLE                                                      -->
        <!-- ========================================================== -->

        <h3>
          Inadimplência Clientes

          <span
            class="tooltip-icon"
            data-tip="Somatório de todos os títulos VENCIDOS (status OVERDUE) sem filtro de período."
            title="Informações"
          >
            ⓘ
          </span>
        </h3>


        <!-- ========================================================== -->
        <!-- VALUE                                                      -->
        <!-- ========================================================== -->

        <div
          class="dash-value"
          data-field="customerOverdueValue"
        >
          R$ 0,00
        </div>


        <!-- ========================================================== -->
        <!-- FOOTER                                                     -->
        <!-- ========================================================== -->

        <footer>
          <span
            data-label="customerOverdueInfo"
          >
            0 título(s) em aberto
          </span>
        </footer>

      </article>
    `;
  },


  // ====================================================================
  // LOAD DATA
  // ====================================================================

  async load(root) {
    try {

      // ---------------------------------------------------------------
      // FETCH API
      // ---------------------------------------------------------------

      const data =
        await fetchDashboard(
          ENDPOINT
        );


      // ---------------------------------------------------------------
      // NORMALIZE VALUES
      // ---------------------------------------------------------------

      const total =
        Number(
          data?.totalAberto ??
          data?.valor ??
          0
        );


      const quantity =
        Number(
          data?.titulosAbertos ??
          data?.qtd ??
          0
        );


      // ---------------------------------------------------------------
      // ELEMENTS
      // ---------------------------------------------------------------

      const valueElement =
        root.querySelector(
          '[data-field="customerOverdueValue"]'
        );


      const infoElement =
        root.querySelector(
          '[data-label="customerOverdueInfo"]'
        );


      // ---------------------------------------------------------------
      // UPDATE VALUE
      // ---------------------------------------------------------------

      if (valueElement) {
        valueElement.textContent =
          moneyBR(total);
      }


      // ---------------------------------------------------------------
      // UPDATE FOOTER
      // ---------------------------------------------------------------

      if (infoElement) {
        infoElement.textContent =
          `${quantity} título(s) em aberto`;
      }


    } catch (error) {

      console.error(
        '[dashboard][customer-overdue] Failed to load:',
        error
      );

    }
  },
};