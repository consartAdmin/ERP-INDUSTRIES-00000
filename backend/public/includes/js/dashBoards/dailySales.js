// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: backend/public/dashBoardsIncludes/js/dailySales.js           ║
// ║ MODULE: Dashboard — Daily Sales                                    ║
// ║ DESCRIPTION:                                                       ║
// ║ - Displays the authorized NF-e sales total for the current day     ║
// ║ - Uses invoicesIssued as the official fiscal revenue source        ║
// ║ - Filters records by the local current date and AUTORIZADO status  ║
// ║ - Excludes canceled, rejected, denied, and pending NF-es           ║
// ║ PRODNEX ERP                                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  moneyBR,
  currentDateBR,
  fetchDashboard,
} from './dashboardUtils.js';


// ======================================================================
// LOCAL DATE FORMATTER
// ======================================================================
// Converts a local JavaScript date to YYYY-MM-DD without applying a UTC
// conversion. This prevents the date from changing because of timezone.
// ======================================================================

function formatLocalDate(
  date = new Date()
) {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      '0'
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      '0'
    );

  return (
    `${year}-${month}-${day}`
  );
}


// ======================================================================
// DAILY SALES DASHBOARD
// ======================================================================

export const dailySalesDashboard = {

  // --------------------------------------------------------------------
  // Dashboard permission and layout key
  // --------------------------------------------------------------------

  key:
    'daily-sales',


  // ====================================================================
  // RENDER
  // ====================================================================
  // Creates the daily-sales dashboard card.
  // ====================================================================

  render() {
    return `
      <article
        class="dash-card"
        data-dashboard-key="daily-sales"
      >
        <h3>
          Vendas do Dia
        </h3>

        <div
          class="dash-value"
          data-field="dailySales"
        >
          R$ 0,00
        </div>

        <footer>
          <span
            data-label="dailySalesPeriod"
          >
            —
          </span>
        </footer>
      </article>
    `;
  },


  // ====================================================================
  // LOAD
  // ====================================================================
  // Requests the authorized NF-e summary for the current local date and
  // updates the card value and its reference period.
  // ====================================================================

  async load(root) {
    try {

      // ----------------------------------------------------------------
      // Current date in YYYY-MM-DD
      // ----------------------------------------------------------------

      const today =
        formatLocalDate();


      // ----------------------------------------------------------------
      // invoicesIssued filters
      // ----------------------------------------------------------------
      // Only authorized NF-es issued today are included.
      //
      // limit=1 is enough because the total is returned in summary.
      // ----------------------------------------------------------------

      const params =
        new URLSearchParams({
          status:
            'AUTORIZADO',

          dateFrom:
            today,

          dateTo:
            today,

          limit:
            '1',

          offset:
            '0',
        });


      // ----------------------------------------------------------------
      // Load official NF-e summary
      // ----------------------------------------------------------------

      const data =
        await fetchDashboard(
          `/api/invoices-issued?${params.toString()}`
        );


      // ----------------------------------------------------------------
      // Normalize total
      // ----------------------------------------------------------------

      const total =
        Number(
          data?.summary?.total_amount ??
          data?.total_amount ??
          0
        );


      // ----------------------------------------------------------------
      // Dashboard elements
      // ----------------------------------------------------------------

      const valueElement =
        root.querySelector(
          '[data-field="dailySales"]'
        );

      const periodElement =
        root.querySelector(
          '[data-label="dailySalesPeriod"]'
        );


      // ----------------------------------------------------------------
      // Update daily-sales value
      // ----------------------------------------------------------------

      if (valueElement) {
        valueElement.textContent =
          moneyBR(
            total
          );
      }


      // ----------------------------------------------------------------
      // Update reference date
      // ----------------------------------------------------------------

      if (periodElement) {
        periodElement.textContent =
          `Referente a ${currentDateBR()}`;
      }

    } catch (error) {
      console.error(
        '[dashboard][daily-sales]',
        error
      );
    }
  },
};