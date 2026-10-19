// ╔══════════════════════════════════════════════════════════════════════╗
// ║ overdueExpenses.js — Dashboard: Overdue Expenses                   ║
// ║ PRODNEX ERP                                                        ║
// ║                                                                      ║
// ║ ✅ Shows overdue expenses percentage                                ║
// ║ ✅ Shows number of overdue titles                                   ║
// ║ ✅ Uses shared dashboard utilities                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  fetchDashboard,
} from './dashboardUtils.js';


// ======================================================================
// CONFIG
// ======================================================================

const DASHBOARD_KEY =
  'overdue-expenses';

const ENDPOINT =
  '/api/dashboard/inadimplencia-despesas';


// ======================================================================
// DASHBOARD
// ======================================================================

export const overdueExpensesDashboard = {

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
          Despesas Atrasadas
        </h3>


        <!-- ========================================================== -->
        <!-- VALUE                                                      -->
        <!-- ========================================================== -->

        <div
          class="dash-value"
          data-field="overdueExpensesPercentage"
        >
          0.0%
        </div>


        <!-- ========================================================== -->
        <!-- FOOTER                                                     -->
        <!-- ========================================================== -->

        <footer>
          <span
            data-label="overdueExpensesInfo"
          >
            0 título(s) em atraso
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

      const percentage =
        Number(
          data?.percentual ??
          data?.perc ??
          0
        );


      const quantity =
        Number(
          data?.titulosEmAtraso ??
          data?.qtd ??
          0
        );


      // ---------------------------------------------------------------
      // ELEMENTS
      // ---------------------------------------------------------------

      const percentageElement =
        root.querySelector(
          '[data-field="overdueExpensesPercentage"]'
        );


      const infoElement =
        root.querySelector(
          '[data-label="overdueExpensesInfo"]'
        );


      // ---------------------------------------------------------------
      // UPDATE PERCENTAGE
      // ---------------------------------------------------------------

      if (percentageElement) {
        percentageElement.textContent =
          `${percentage.toFixed(1)}%`;
      }


      // ---------------------------------------------------------------
      // UPDATE FOOTER
      // ---------------------------------------------------------------

      if (infoElement) {
        infoElement.textContent =
          `${quantity} título(s) em atraso`;
      }


    } catch (error) {

      // ---------------------------------------------------------------
      // ERROR
      // ---------------------------------------------------------------

      console.error(
        '[dashboard][overdue-expenses] Failed to load:',
        error
      );

    }
  },
};