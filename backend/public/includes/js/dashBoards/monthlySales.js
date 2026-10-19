import {
  moneyBR,
  currentMonthBR,
  fetchDashboard,
} from './dashboardUtils.js';

function formatLocalDate(date) {
  const year =
    date.getFullYear();

  const month =
    String(date.getMonth() + 1)
      .padStart(2, '0');

  const day =
    String(date.getDate())
      .padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getCurrentMonthRange() {
  const now =
    new Date();

  const firstDay =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );

  const lastDay =
    new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0
    );

  return {
    dateFrom:
      formatLocalDate(firstDay),

    dateTo:
      formatLocalDate(lastDay),
  };
}

export const monthlySalesDashboard = {
  key: 'monthly-sales',

  render() {
    return `
      <article
        class="dash-card"
        data-dashboard-key="monthly-sales"
      >
        <h3>Vendas do Mês</h3>

        <div
          class="dash-value"
          data-field="monthlySales"
        >
          R$ 0,00
        </div>

        <footer>
          <span data-label="monthlySalesPeriod">
            —
          </span>
        </footer>
      </article>
    `;
  },

  async load(root) {
    try {
      const {
        dateFrom,
        dateTo,
      } = getCurrentMonthRange();

      const params =
        new URLSearchParams({
          status: 'AUTORIZADO',
          dateFrom,
          dateTo,
          limit: '1',
          offset: '0',
        });

      const data =
        await fetchDashboard(
          `/api/invoices-issued?${params.toString()}`
        );

      const total =
        Number(
          data?.summary?.total_amount ??
          data?.total_amount ??
          0
        );

      const valueElement =
        root.querySelector(
          '[data-field="monthlySales"]'
        );

      const periodElement =
        root.querySelector(
          '[data-label="monthlySalesPeriod"]'
        );

      if (valueElement) {
        valueElement.textContent =
          moneyBR(total);
      }

      if (periodElement) {
        periodElement.textContent =
          `Mês ${currentMonthBR()}`;
      }

    } catch (error) {
      console.error(
        '[dashboard][monthly-sales]',
        error
      );
    }
  },
};