// ╔════════════════════════════════════════════════════════════════════╗
// ║ pdvSalesReportController.js — Relatório de Vendas PDV (Backend)   ║
// ║ CONSART ERP — Endpoint: GET /api/reports/pdv-sales                ║
// ║                                                                    ║
// ║ Usa: public."pdvSales" e public."pdvSalesItems"                   ║
// ║ Campos chave:                                                     ║
// ║   - Valor da venda:  recebido                                     ║
// ║   - Data base:       created_at                                   ║
// ║   - Cliente:         customer_name                                ║
// ║   - Cupom:           nfce_number                                  ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../config/db.js';

import archiver from 'archiver';

const TABLE_PDV_SALES = 'public."pdvSales"';
const TABLE_PDV_SALES_ITEMS = 'public."pdvSalesItems"';

// ---------------------------------------------------------------------
// Helpers de datas
// ---------------------------------------------------------------------

function getPlugNotasHeaders() {
  const environment = String(
    process.env.NFE_AMBIENTE || 'homologacao'
  ).toLowerCase();

  const apiKey = environment === 'producao'
    ? (process.env.PLUGNOTAS_API_KEY_REAL || process.env.PLUGNOTAS_API_KEY)
    : (process.env.PLUGNOTAS_API_KEY_HOMOLOG || process.env.PLUGNOTAS_API_KEY);

  if (!apiKey) {
    throw new Error('A chave da API PlugNotas não está configurada.');
  }

  return {
    Accept: 'application/xml,text/xml,application/octet-stream,*/*',
    'X-API-KEY': apiKey
  };
}

function parseDateOrNull(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function getDefaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    startDateIso: start.toISOString(),
    endDateIso: end.toISOString()
  };
}

export async function downloadPdvSalesXmls(req, res) {
  const client = await pool.connect();

  try {
    const {
      startDate,
      endDate,
      month,
      year
    } = req.query || {};

    let startDateIso = parseDateOrNull(startDate);
    let endDateIso = parseDateOrNull(endDate);

    // Se informou mês, monta o intervalo completo do mês
    if ((!startDateIso || !endDateIso) && month) {
      const selectedYear =
        Number(year) || new Date().getFullYear();

      const selectedMonth = Number(month) - 1;

      const firstDay = new Date(
        Date.UTC(selectedYear, selectedMonth, 1, 0, 0, 0, 0)
      );

      const nextMonth = new Date(
        Date.UTC(selectedYear, selectedMonth + 1, 1, 0, 0, 0, 0)
      );

      startDateIso = firstDay.toISOString();
      endDateIso = new Date(
        nextMonth.getTime() - 1
      ).toISOString();
    }

    // Se nenhuma data foi informada, utiliza os últimos 30 dias
    if (!startDateIso || !endDateIso) {
      const range = getDefaultDateRange();

      startDateIso = range.startDateIso;
      endDateIso = range.endDateIso;
    }

    const sql = `
      SELECT
        s."sale_id",
        s."nfce_number",
        s."nfce_key",
        s."created_at",
        s."nfce_xml_url"
      FROM ${TABLE_PDV_SALES} s
      WHERE s."created_at" >= $1
        AND s."created_at" <= $2
        AND s."status" = 'FECHADA'
        AND s."nfce_status" = 'AUTORIZADA'
        AND s."nfce_xml_url" IS NOT NULL
        AND NULLIF(TRIM(s."nfce_xml_url"), '') IS NOT NULL
      ORDER BY s."created_at", s."sale_id";
    `;

    const result = await client.query(sql, [
      startDateIso,
      endDateIso
    ]);

    if (!result.rows.length) {
      return res.status(404).json({
        error: 'Nenhum XML encontrado para os filtros informados.'
      });
    }

    /*
     * Baixa os XMLs antes de iniciar a resposta ZIP.
     * Assim ainda podemos retornar um JSON de erro caso todos falhem.
     */
    const xmlFiles = [];
    const failedDownloads = [];

    for (const row of result.rows) {
      try {
        const xmlUrl = new URL(row.nfce_xml_url);

        if (!['http:', 'https:'].includes(xmlUrl.protocol)) {
          throw new Error('Protocolo da URL não permitido.');
        }

        const controller = new AbortController();

        const timeout = setTimeout(() => {
          controller.abort();
        }, 30000);

        let xmlResponse;

        try {
          xmlResponse = await fetch(xmlUrl, {
            method: 'GET',
            headers: getPlugNotasHeaders(),
            signal: controller.signal,
            redirect: 'follow'
          });
        } finally {
          clearTimeout(timeout);
        }

        if (!xmlResponse.ok) {
          throw new Error(
            `Servidor do XML retornou HTTP ${xmlResponse.status}.`
          );
        }

        const xmlBuffer = Buffer.from(
          await xmlResponse.arrayBuffer()
        );

        if (!xmlBuffer.length) {
          throw new Error('O XML retornado está vazio.');
        }

        const couponIdentifier = String(
          row.nfce_number ||
          row.nfce_key ||
          row.sale_id
        ).replace(/[^a-zA-Z0-9_-]/g, '_');

        xmlFiles.push({
          filename: `NFCe-${couponIdentifier}.xml`,
          content: xmlBuffer
        });
      } catch (error) {
        console.error(
          `[PDV XML] Falha na venda ${row.sale_id}:`,
          error.message
        );

        failedDownloads.push({
          saleId: row.sale_id,
          nfceNumber: row.nfce_number,
          error: error.message
        });
      }
    }

    if (!xmlFiles.length) {
      return res.status(502).json({
        error: 'Os XMLs foram encontrados, mas não puderam ser baixados.',
        details: failedDownloads
          .map((item) => {
            return `Venda ${item.saleId}: ${item.error}`;
          })
          .join(' | ')
      });
    }

    const fileDate = new Date()
      .toISOString()
      .slice(0, 10);

    const zipFilename = `xmls-pdv-${fileDate}.zip`;

    res.status(200);

    res.setHeader(
      'Content-Type',
      'application/zip'
    );

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${zipFilename}"`
    );

    res.setHeader('Cache-Control', 'no-store');

    /*
     * Informa quantos downloads falharam sem impedir
     * o download dos XMLs que funcionaram.
     */
    res.setHeader(
      'X-XML-Success-Count',
      String(xmlFiles.length)
    );

    res.setHeader(
      'X-XML-Failed-Count',
      String(failedDownloads.length)
    );

    const archive = archiver('zip', {
      zlib: {
        level: 9
      }
    });

    archive.on('warning', (error) => {
      console.warn('[PDV XML] Aviso no ZIP:', error);
    });

    archive.on('error', (error) => {
      console.error('[PDV XML] Erro no ZIP:', error);
      res.destroy(error);
    });

    archive.pipe(res);

    for (const xmlFile of xmlFiles) {
      archive.append(xmlFile.content, {
        name: xmlFile.filename
      });
    }

    /*
     * Inclui um relatório dentro do ZIP quando algum
     * XML não pôde ser baixado.
     */
    if (failedDownloads.length) {
      const failureReport = failedDownloads
        .map((item) => {
          return [
            `Venda: ${item.saleId}`,
            `NFC-e: ${item.nfceNumber || 'Não informada'}`,
            `Erro: ${item.error}`,
            ''
          ].join('\n');
        })
        .join('\n');

      archive.append(failureReport, {
        name: '_xmls-nao-baixados.txt'
      });
    }

    await archive.finalize();
  } catch (error) {
    console.error(
      '[downloadPdvSalesXmls] Erro ao preparar XMLs:',
      error
    );

    if (!res.headersSent) {
      res.status(500).json({
        error: 'Erro ao preparar os XMLs.',
        details: error.message
      });
    } else {
      res.destroy(error);
    }
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------
// Controller principal
// ---------------------------------------------------------------------

export async function getPdvSalesReport(req, res) {
  const client = await pool.connect();

  try {
    const {
      startDate,
      endDate,
      month,
      year,
      // por enquanto não vamos filtrar por cliente/produto
      // customerId,
      // productId,
    } = req.query || {};

    let startDateIso = parseDateOrNull(startDate);
    let endDateIso = parseDateOrNull(endDate);

    // Se não informou datas, mas informou mês/ano → monta intervalo do mês
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

    // Somente vendas fechadas
    where.push(`s."status" = 'FECHADA'`);

    // E NFC-e autorizada (ajuste se quiser incluir pendentes)
    where.push(`s."nfce_status" = 'AUTORIZADA'`);

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // -------------------------------------------------------------------
    // CTE com itens da venda (para poder somar quantidade)
    // -------------------------------------------------------------------
    // OBS: ajuste o nome da coluna de quantidade em pdvSalesItems se for diferente
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

    // -------------------------------------------------------------------
    // Resposta final
    // -------------------------------------------------------------------
    res.json({
      filters: {
        startDate: startDateIso,
        endDate: endDateIso
      },
      summary,
      detailByDay,
      detailByCustomer,
      detailBySale
    });
  } catch (err) {
    console.error('[pdvSalesReportController] Erro ao montar relatório PDV:', err);
    res.status(500).json({
      error: 'Erro ao montar relatório de vendas PDV.',
      details: err.message
    });
  } finally {
    client.release();
  }
}