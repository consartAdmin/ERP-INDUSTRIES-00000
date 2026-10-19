// ╔════════════════════════════════════════════════════════════════════╗
// ║ pdvSalesReportQuery.repository.js — getPdvSalesReportData          ║
// ║ Tabelas: public."pdvSales" / public."pdvSalesItems"                ║
// ║ Retorno: { filters, summary, detailByDay, detailByCustomer,        ║
// ║            detailBySale }                                          ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE_PDV_SALES, TABLE_PDV_SALES_ITEMS } from './pdvSalesReport.constants.js';
import { parseDateOrNull, getDefaultDateRange } from './pdvSalesReport.utils.js';

/**
 * Monta o relatório PDV a partir dos filtros
 * @param {Object} filters { startDate, endDate, month, year }
 */
export async function getPdvSalesReportData(filters = {}) {
  const client = await pool.connect();

  try {
    const {
      startDate,
      endDate,
      month,
      year
      // (reservado) customerId, productId...
    } = filters;

    let startDateIso = parseDateOrNull(startDate);
    let endDateIso = parseDateOrNull(endDate);

    // Se não informou datas, mas informou mês/ano → intervalo do mês
    if ((!startDateIso || !endDateIso) && month) {
      const y = Number(year) || new Date().getFullYear();
      const m = Number(month) - 1; // 0–11

      const first = new Date(Date.UTC(y, m, 1, 0, 0, 0));
      const nextMonth = new Date(Date.UTC(y, m + 1, 1, 0, 0, 0));
      const last = new Date(nextMonth.getTime() - 1);

      startDateIso = first.toISOString();
      endDateIso = last.toISOString();
    }

    // Se ainda não tem datas → últimos 30 dias
    if (!startDateIso || !endDateIso) {
      const range = getDefaultDateRange();
      startDateIso = range.startDateIso;
      endDateIso = range.endDateIso;
    }

    // -------------------------------------------------------------------
    // WHERE base: período + status (FECHADA) + nfce_status (AUTORIZADA)
    // -------------------------------------------------------------------
    const where = [];
    const params = [];
    let idx = 1;

    where.push(`s."created_at" >= $${idx++}`);
    params.push(startDateIso);

    where.push(`s."created_at" <= $${idx++}`);
    params.push(endDateIso);

    where.push(`s."status" = 'FECHADA'`);
    where.push(`s."nfce_status" = 'AUTORIZADA'`);

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const baseCte = `
      WITH sales_with_items AS (
        SELECT
          s."sale_id",
          s."created_at",
          s."customer_name",
          s."recebido",
          s."nfce_number",
          s."nfce_status",
          s."status",
          COALESCE(SUM(i."quantity"), 0) AS items_count
        FROM ${TABLE_PDV_SALES} s
        LEFT JOIN ${TABLE_PDV_SALES_ITEMS} i
          ON i."sale_id" = s."sale_id"
        ${whereSql}
        GROUP BY
          s."sale_id",
          s."created_at",
          s."customer_name",
          s."recebido",
          s."nfce_number",
          s."nfce_status",
          s."status"
      )
    `;

    // -------------------------------------------------------------------
    // 1) Summary (KPIs)
    // -------------------------------------------------------------------
    const summarySql = `
      ${baseCte}
      SELECT
        COALESCE(SUM(recebido), 0)        AS total_sold,
        COUNT(*)                          AS orders,
        COALESCE(SUM(items_count), 0)     AS items_sold,
        CASE
          WHEN COUNT(*) > 0
          THEN COALESCE(SUM(recebido), 0) / COUNT(*)
          ELSE 0
        END                               AS avg_ticket,
        0::numeric                        AS gross_profit -- por enquanto
      FROM sales_with_items;
    `;

    const summaryResult = await client.query(summarySql, params);
    const summaryRow = summaryResult.rows[0] || {};

    const summary = {
      totalSold: Number(summaryRow.total_sold || 0),
      orders: Number(summaryRow.orders || 0),
      itemsSold: Number(summaryRow.items_sold || 0),
      avgTicket: Number(summaryRow.avg_ticket || 0),
      grossProfit: Number(summaryRow.gross_profit || 0)
    };

    // -------------------------------------------------------------------
    // 2) Detalhamento por dia
    // -------------------------------------------------------------------
    const byDaySql = `
      ${baseCte}
      SELECT
        date_trunc('day', created_at)::date AS date,
        COUNT(*)                            AS orders,
        COALESCE(SUM(items_count), 0)       AS items,
        COALESCE(SUM(recebido), 0)          AS total
      FROM sales_with_items
      GROUP BY date_trunc('day', created_at)::date
      ORDER BY date_trunc('day', created_at)::date;
    `;

    const byDayResult = await client.query(byDaySql, params);
    const detailByDay = byDayResult.rows.map((row) => ({
      date: row.date,
      orders: Number(row.orders || 0),
      items: Number(row.items || 0),
      total: Number(row.total || 0)
    }));

    // -------------------------------------------------------------------
    // 3) Detalhamento por cliente
    // -------------------------------------------------------------------
    const byCustomerSql = `
      ${baseCte}
      SELECT
        COALESCE(NULLIF(TRIM(customer_name), ''), 'CONSUMIDOR FINAL') AS customer,
        COUNT(*)                            AS orders,
        COALESCE(SUM(items_count), 0)       AS items,
        COALESCE(SUM(recebido), 0)          AS total
      FROM sales_with_items
      GROUP BY COALESCE(NULLIF(TRIM(customer_name), ''), 'CONSUMIDOR FINAL')
      ORDER BY total DESC;
    `;

    const byCustomerResult = await client.query(byCustomerSql, params);
    const detailByCustomer = byCustomerResult.rows.map((row) => ({
      customer: row.customer,
      orders: Number(row.orders || 0),
      items: Number(row.items || 0),
      total: Number(row.total || 0)
    }));

    // -------------------------------------------------------------------
    // 4) Detalhamento por cupom (uma linha por venda)
    // -------------------------------------------------------------------
    const bySaleSql = `
      ${baseCte}
      SELECT
        sale_id,
        created_at,
        COALESCE(NULLIF(TRIM(customer_name), ''), 'CONSUMIDOR FINAL') AS customer,
        items_count                                                  AS items,
        recebido                                                     AS total,
        nfce_number
      FROM sales_with_items
      ORDER BY created_at, sale_id;
    `;

    const bySaleResult = await client.query(bySaleSql, params);
    const detailBySale = bySaleResult.rows.map((row) => ({
      id: Number(row.sale_id),
      date: row.created_at,
      customer: row.customer,
      items: Number(row.items || 0),
      total: Number(row.total || 0),
      couponNumber: row.nfce_number
    }));

    return {
      filters: {
        startDate: startDateIso,
        endDate: endDateIso
      },
      summary,
      detailByDay,
      detailByCustomer,
      detailBySale
    };
  } finally {
    client.release();
  }
}
