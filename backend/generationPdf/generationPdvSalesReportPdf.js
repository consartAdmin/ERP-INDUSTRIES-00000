// ╔══════════════════════════════════════════════════════════════════════╗
// ║ generationPdvSalesReportPdf.js — PDF/CSV Relatório PDV (ESM)       ║
// ║ Caminho: backend/generationPdf/generationPdvSalesReportPdf.js      ║
// ║ - Gera Buffer de PDF com base no pdvSalesReportApi                 ║
// ║ - Modos: full | customers | coupons                                ║
// ║ - Exporta também CSV por visão                                     ║
// ║ - Inclui itens por cupom + lucro bruto (products.cost_price)       ║
// ╚══════════════════════════════════════════════════════════════════════╝

import PDFDocument from 'pdfkit';
import { getPdvSalesReportData } from '../repositories/pdvSalesReport/pdvSalesReport.index.js';
import pool from '../config/db.js';

// ---------------------------------------------------------------------
// Helpers de formatação
// ---------------------------------------------------------------------

const moneyBR = (v) =>
  Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });

function formatDateBR(d) {
  if (!d) return '-';
  try {
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return d;
    return date.toLocaleDateString('pt-BR');
  } catch {
    return d;
  }
}

function drawSectionTitle(doc, text) {
  doc
    .fontSize(12)
    .font('Helvetica-Bold')
    .fillColor('#111111')
    .text(text);
  doc.moveDown(0.2);
  doc
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .strokeColor('#cbd5e1')
    .lineWidth(0.6)
    .stroke();
  doc.moveDown(0.4);
}

function drawTableHeader(doc, headers) {
  const topY = doc.y;
  const fullWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;

  doc
    .rect(doc.page.margins.left, topY - 2, fullWidth, 16)
    .fill('#e5edf6');

  doc.fontSize(9).font('Helvetica-Bold').fillColor('#111827');

  headers.forEach((h) => {
    doc.text(h.label, h.x, topY, { width: h.w });
  });

  doc
    .moveTo(doc.page.margins.left, topY + 16)
    .lineTo(doc.page.width - doc.page.margins.right, topY + 16)
    .strokeColor('#cbd5e1')
    .lineWidth(0.4)
    .stroke();

  doc.y = topY + 18;
}

// ---------------------------------------------------------------------
// Busca itens por cupom com custo (products.cost_price)
// ---------------------------------------------------------------------
// Baseado no seu schema real:
//
//   public."products":
//     - product_code  (chave única de produto)
//     - cost_price    (custo unitário)
//
//   public."pdvSalesItems":
//     - sale_id
//     - product_code
//     - description
//     - quantity
//     - prices        (preço unitário)
//     - total_prices  (total do item)
// ---------------------------------------------------------------------

async function fetchItemsBySaleWithCost(detailBySale = []) {
  const result = {
    itemsBySale: new Map(), // sale_id -> array de itens
    itemsFlat: [],          // lista achatada (para tabela detalhada)
    computedGrossProfit: 0  // lucro bruto total calculado
  };

  const saleIds = [
    ...new Set(
      detailBySale
        .map((s) => (s && s.id != null ? Number(s.id) : null))
        .filter((v) => !Number.isNaN(v) && v != null)
    )
  ];

  if (!saleIds.length) return result;

  const client = await pool.connect();
  try {
    const sql = `
      SELECT
        i."sale_id",
        i."product_code",
        i."description",
        i."quantity",
        i."prices",
        i."total_prices",
        p."cost_price"
      FROM public."pdvSalesItems" i
      LEFT JOIN public."products" p
        ON p."product_code" = i."product_code"
      WHERE i."sale_id" = ANY($1::bigint[])
      ORDER BY i."sale_id", i."sale_item_id";
    `;

    const { rows } = await client.query(sql, [saleIds]);

    for (const row of rows) {
      const saleId = Number(row.sale_id);
      const qty = Number(row.quantity || 0);
      const unitPrice = Number(row.prices || 0);
      const total =
        row.total_prices != null
          ? Number(row.total_prices)
          : qty * unitPrice;
      const costPrice = Number(row.cost_price || 0);
      const totalCost = costPrice * qty;
      const gross = total - totalCost;

      const item = {
        saleId,
        sku: row.product_code,
        description: row.description,
        quantity: qty,
        unitPrice,
        total,
        costPrice,
        gross
      };

      // Agrupado por venda
      const list = result.itemsBySale.get(saleId) || [];
      list.push(item);
      result.itemsBySale.set(saleId, list);

      // Flat
      result.itemsFlat.push(item);

      result.computedGrossProfit += gross;
    }

    return result;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------

export async function generatePdvSalesReportPdf(filters = {}, mode = 'full') {
  const data = await getPdvSalesReportData(filters);
  const modeSafe = ['full', 'customers', 'coupons'].includes(mode)
    ? mode
    : 'full';

  const {
    summary: summaryRaw = {},
    detailByDay = [],
    detailByCustomer = [],
    detailBySale = []
  } = data;

  // Carrega itens + custo das vendas (para lucro bruto e tabela detalhada)
  let itemsBySale = new Map();
  let itemsFlat = [];
  let computedGrossProfit = 0;

  try {
    const fetched = await fetchItemsBySaleWithCost(detailBySale);
    itemsBySale = fetched.itemsBySale;
    itemsFlat = fetched.itemsFlat;
    computedGrossProfit = fetched.computedGrossProfit;
  } catch (err) {
    console.error(
      '[generationPdvSalesReportPdf] Erro ao carregar itens/custo:',
      err
    );
  }

  // Monta resumo geral
  const totalAmount = Number(summaryRaw.totalSold || 0);
  const ordersCount = Number(summaryRaw.orders || 0);
  const itemsCount = Number(summaryRaw.itemsSold || 0);
  const ticket = Number(summaryRaw.avgTicket || 0);

  // Se vier 0 do relatório, usamos o calculado pelos itens
  let grossProfit = Number(summaryRaw.grossProfit || 0);
  if (!grossProfit && computedGrossProfit) {
    grossProfit = computedGrossProfit;
  }

  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 40,
    info: {
      Title: 'Relatório de Vendas PDV - CONSART ERP',
      Author: 'CONSART ERP',
      Subject: 'Relatório consolidado de vendas PDV (NFC-e)'
    }
  });

  const chunks = [];
  return await new Promise((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const startX = doc.page.margins.left;

    // Cabeçalho
    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .fillColor('#0f172a')
      .text('CONSART ERP', startX, doc.page.margins.top - 20, {
        align: 'left'
      });

    let subtitle = 'Relatório de Vendas PDV (NFC-e)';
    if (modeSafe === 'customers')
      subtitle = 'Relatório de Vendas PDV por Cliente';
    if (modeSafe === 'coupons') subtitle = 'Relatório de Vendas por Cupom';

    doc
      .moveDown(0.1)
      .fontSize(11)
      .font('Helvetica')
      .fillColor('#374151')
      .text(subtitle);

    const periodStart = data.filters?.startDate || 'Últimos 30 dias';
    const periodEnd = data.filters?.endDate || '';

    doc
      .moveDown(0.4)
      .fontSize(9)
      .fillColor('#4b5563')
      .text(
        `Período: ${formatDateBR(periodStart)}${
          periodEnd ? ' até ' + formatDateBR(periodEnd) : ''
        }`
      );

    doc.moveDown(0.5);
    doc
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .strokeColor('#cbd5e1')
      .lineWidth(0.8)
      .stroke();

    doc.moveDown(0.8);

    // ===================================================================
    // RESUMO GERAL (cards)
    // ===================================================================
    drawSectionTitle(doc, 'Resumo Geral');

    const cardW = 150;
    const yCards = doc.y;
    const gap = 10;

    const cards = [
      { label: 'Total vendido', value: moneyBR(totalAmount) },
      { label: 'Cupons', value: String(ordersCount) },
      { label: 'Itens vendidos', value: String(itemsCount) },
      { label: 'Ticket médio', value: moneyBR(ticket) },
      { label: 'Lucro bruto (estimado)', value: moneyBR(grossProfit) }
    ];

    doc.font('Helvetica');
    cards.forEach((c, idx) => {
      const col = idx % 4;
      const row = Math.floor(idx / 4);
      const x = startX + col * (cardW + gap);
      const y = yCards + row * 40;

      doc
        .roundedRect(x, y, cardW, 34, 6)
        .fillAndStroke('#f9fafb', '#e5e7eb');

      doc
        .fontSize(8)
        .fillColor('#6b7280')
        .text(c.label, x + 8, y + 5, { width: cardW - 16 });
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#111827')
        .text(c.value, x + 8, y + 16, { width: cardW - 16 });
    });

    doc.y = yCards + 80;
    doc.moveDown(0.8);

    // ===================================================================
    // TABELAS
    // ===================================================================

    // -------------------------------------------------------------------
    // 1) Por dia (apenas em FULL)
    // -------------------------------------------------------------------
    if (modeSafe === 'full') {
      drawSectionTitle(doc, 'Vendas por Dia');

      const cols = [
        { label: 'Data', x: startX, w: 80 },
        { label: 'Cupons', x: startX + 80, w: 80 },
        { label: 'Itens', x: startX + 160, w: 80 },
        { label: 'Total vendido', x: startX + 240, w: 140 }
      ];

      if (!detailByDay.length) {
        doc
          .fontSize(9)
          .font('Helvetica-Oblique')
          .fillColor('#6b7280')
          .text('Sem registros para o período.');
      } else {
        drawTableHeader(doc, cols);
        doc.font('Helvetica').fontSize(9).fillColor('#111827');

        detailByDay.forEach((r, idx) => {
          if (doc.y > doc.page.height - 80) {
            doc.addPage();
            drawSectionTitle(doc, 'Vendas por Dia (cont.)');
            drawTableHeader(doc, cols);
          }

          const y = doc.y;

          if (idx % 2 === 0) {
            doc
              .rect(
                doc.page.margins.left,
                y - 1,
                doc.page.width - doc.page.margins.left - doc.page.margins.right,
                14
              )
              .fill('#f9fafb');
            doc.fillColor('#111827');
          }

          doc.text(formatDateBR(r.date), cols[0].x, y, { width: cols[0].w });
          doc.text(String(r.orders || 0), cols[1].x, y, { width: cols[1].w });
          doc.text(String(r.items || 0), cols[2].x, y, { width: cols[2].w });
          doc.text(moneyBR(r.total || 0), cols[3].x, y, { width: cols[3].w });

          doc.y = y + 14;
        });
      }

      doc.moveDown(1);
    }

    // -------------------------------------------------------------------
    // 2) Por cliente (FULL + customers)
    // -------------------------------------------------------------------
    if (modeSafe === 'full' || modeSafe === 'customers') {
      drawSectionTitle(doc, 'Vendas por Cliente');

      const cols = [
        { label: 'Cliente', x: startX, w: 260 },
        { label: 'Cupons', x: startX + 260, w: 80 },
        { label: 'Itens', x: startX + 340, w: 80 },
        { label: 'Total vendido', x: startX + 420, w: 160 }
      ];

      if (!detailByCustomer.length) {
        doc
          .fontSize(9)
          .font('Helvetica-Oblique')
          .fillColor('#6b7280')
          .text('Sem registros.');
      } else {
        drawTableHeader(doc, cols);
        doc.font('Helvetica').fontSize(9).fillColor('#111827');

        detailByCustomer.forEach((r, idx) => {
          if (doc.y > doc.page.height - 80) {
            doc.addPage();
            drawSectionTitle(doc, 'Vendas por Cliente (cont.)');
            drawTableHeader(doc, cols);
          }

          const y = doc.y;

          if (idx % 2 === 0) {
            doc
              .rect(
                doc.page.margins.left,
                y - 1,
                doc.page.width - doc.page.margins.left - doc.page.margins.right,
                14
              )
              .fill('#f9fafb');
            doc.fillColor('#111827');
          }

          doc.text(r.customer || 'CONSUMIDOR FINAL', cols[0].x, y, {
            width: cols[0].w
          });
          doc.text(String(r.orders || 0), cols[1].x, y, { width: cols[1].w });
          doc.text(String(r.items || 0), cols[2].x, y, { width: cols[2].w });
          doc.text(moneyBR(r.total || 0), cols[3].x, y, { width: cols[3].w });

          doc.y = y + 14;
        });
      }

      doc.moveDown(1);
    }

    // -------------------------------------------------------------------
    // 3) Por cupom (FULL + coupons) — RESUMO
    // -------------------------------------------------------------------
    if (modeSafe === 'full' || modeSafe === 'coupons') {
      drawSectionTitle(doc, 'Vendas por Cupom / NFC-e');

      const cols = [
        { label: 'Data', x: startX, w: 80 },
        { label: 'Nº Cupom / NFC-e', x: startX + 80, w: 140 },
        { label: 'Cliente', x: startX + 220, w: 260 },
        { label: 'Qtde itens', x: startX + 480, w: 80 },
        { label: 'Total venda', x: startX + 560, w: 140 }
      ];

      if (!detailBySale.length) {
        doc
          .fontSize(9)
          .font('Helvetica-Oblique')
          .fillColor('#6b7280')
          .text('Sem registros.');
      } else {
        drawTableHeader(doc, cols);
        doc.font('Helvetica').fontSize(9).fillColor('#111827');

        detailBySale.forEach((r, idx) => {
          if (doc.y > doc.page.height - 80) {
            doc.addPage();
            drawSectionTitle(doc, 'Vendas por Cupom / NFC-e (cont.)');
            drawTableHeader(doc, cols);
          }

          const y = doc.y;

          if (idx % 2 === 0) {
            doc
              .rect(
                doc.page.margins.left,
                y - 1,
                doc.page.width - doc.page.margins.left - doc.page.margins.right,
                14
              )
              .fill('#f9fafb');
            doc.fillColor('#111827');
          }

          doc.text(formatDateBR(r.date), cols[0].x, y, { width: cols[0].w });
          doc.text(r.couponNumber || '', cols[1].x, y, {
            width: cols[1].w
          });
          doc.text(r.customer || 'CONSUMIDOR FINAL', cols[2].x, y, {
            width: cols[2].w
          });
          doc.text(String(r.items || 0), cols[3].x, y, { width: cols[3].w });
          doc.text(moneyBR(r.total || 0), cols[4].x, y, { width: cols[4].w });

          doc.y = y + 14;
        });
      }

      doc.moveDown(1);

      // -----------------------------------------------------------------
      // 4) Itens por Cupom / NFC-e — UMA TABELA POR VENDA
      // -----------------------------------------------------------------
      if (detailBySale.length && itemsBySale.size) {
        drawSectionTitle(doc, 'Itens por Cupom / NFC-e (uma tabela por venda)');

        const colsItems = [
          { label: 'SKU',        x: startX,       w: 80 },
          { label: 'Produto',    x: startX + 80,  w: 260 },
          { label: 'Qtde',       x: startX + 340, w: 50 },
          { label: 'Unitário',   x: startX + 390, w: 80 },
          { label: 'Total',      x: startX + 470, w: 80 },
          { label: 'Custo',      x: startX + 550, w: 80 },
          { label: 'Lucro',      x: startX + 630, w: 80 }
        ];

        // Map com info da venda (data, cupom, cliente, total)
        const saleInfoById = new Map();
        detailBySale.forEach((s) => {
          saleInfoById.set(Number(s.id), {
            date: s.date,
            couponNumber: s.couponNumber,
            customer: s.customer,
            total: s.total
          });
        });

        // Para cada venda, imprime um cabeçalho + tabela dos itens
        detailBySale.forEach((sale, saleIndex) => {
          const saleId = Number(sale.id);
          const items = itemsBySale.get(saleId) || [];
          if (!items.length) return;

          // Quebra de página se estiver muito embaixo
          if (doc.y > doc.page.height - 140) {
            doc.addPage();
            drawSectionTitle(doc, 'Itens por Cupom / NFC-e (uma tabela por venda) (cont.)');
          }

          const info = saleInfoById.get(saleId) || {};
          const saleGross = items.reduce(
            (acc, it) => acc + Number(it.gross || 0),
            0
          );

          // Cabeçalho da venda
          doc
            .fontSize(9)
            .font('Helvetica-Bold')
            .fillColor('#111827')
            .text(
              `Cupom: ${info.couponNumber || ''}  |  Data: ${formatDateBR(
                info.date
              )}  |  Cliente: ${info.customer || 'CONSUMIDOR FINAL'}`,
              startX,
              doc.y
            );
          doc
            .moveDown(0.2)
            .fontSize(8)
            .font('Helvetica')
            .fillColor('#4b5563')
            .text(
              `Total da venda: ${moneyBR(info.total || 0)}  |  Lucro bruto desta venda: ${moneyBR(
                saleGross
              )}`,
              startX
            );
          doc.moveDown(0.3);

          // Cabeçalho da tabela de itens
          drawTableHeader(doc, colsItems);
          doc.font('Helvetica').fontSize(8.5).fillColor('#111827');

          items.forEach((it, idxItem) => {
            if (doc.y > doc.page.height - 80) {
              // Nova página → reimprime título, cabeçalho da venda e cabeçalho da tabela
              doc.addPage();
              drawSectionTitle(
                doc,
                'Itens por Cupom / NFC-e (uma tabela por venda) (cont.)'
              );

              doc
                .fontSize(9)
                .font('Helvetica-Bold')
                .fillColor('#111827')
                .text(
                  `Cupom: ${info.couponNumber || ''}  |  Data: ${formatDateBR(
                    info.date
                  )}  |  Cliente: ${info.customer || 'CONSUMIDOR FINAL'}`,
                  startX,
                  doc.y
                );
              doc
                .moveDown(0.2)
                .fontSize(8)
                .font('Helvetica')
                .fillColor('#4b5563')
                .text(
                  `Total da venda: ${moneyBR(info.total || 0)}  |  Lucro bruto desta venda: ${moneyBR(
                    saleGross
                  )}`,
                  startX
                );
              doc.moveDown(0.3);

              drawTableHeader(doc, colsItems);
              doc.font('Helvetica').fontSize(8.5).fillColor('#111827');
            }

            const y = doc.y;

            // Zebra
            if ((idxItem % 2) === 0) {
              doc
                .rect(
                  doc.page.margins.left,
                  y - 1,
                  doc.page.width -
                    doc.page.margins.left -
                    doc.page.margins.right,
                  14
                )
                .fill('#f9fafb');
              doc.fillColor('#111827');
            }

            doc.text(it.sku || '', colsItems[0].x, y, {
              width: colsItems[0].w
            });
            doc.text(
              (it.description || '').slice(0, 80),
              colsItems[1].x,
              y,
              { width: colsItems[1].w }
            );
            doc.text(String(it.quantity || 0), colsItems[2].x, y, {
              width: colsItems[2].w
            });
            doc.text(moneyBR(it.unitPrice || 0), colsItems[3].x, y, {
              width: colsItems[3].w
            });
            doc.text(moneyBR(it.total || 0), colsItems[4].x, y, {
              width: colsItems[4].w
            });
            doc.text(moneyBR(it.costPrice || 0), colsItems[5].x, y, {
              width: colsItems[5].w
            });
            doc.text(moneyBR(it.gross || 0), colsItems[6].x, y, {
              width: colsItems[6].w
            });

            doc.y = y + 14;
          });

          doc.moveDown(0.8);
        });
      }
    }

    // Rodapé
    doc.moveDown(1.0);
    doc
      .fontSize(8)
      .font('Helvetica-Oblique')
      .fillColor('#6b7280')
      .text(
        `Gerado em ${new Date().toLocaleString(
          'pt-BR'
        )} pelo CONSART ERP`,
        {
          align: 'right'
        }
      );

    doc.end();
  });
}

// ---------------------------------------------------------------------
// CSV (continua igual, ainda sem custo/lucro por item)
// ---------------------------------------------------------------------

export async function generatePdvSalesReportCsv(filters = {}, view = 'day') {
  const data = await getPdvSalesReportData(filters);
  const viewSafe = ['day', 'customer', 'coupon'].includes(view)
    ? view
    : 'day';

  const lines = [];
  const sep = ';';

  const fmtIsoDate = (d) => {
    if (!d) return '';
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return '';
    return dt.toISOString().slice(0, 10);
  };

  if (viewSafe === 'day') {
    lines.push(['data', 'cupons', 'itens', 'total'].join(sep));
    (data.detailByDay || []).forEach((r) => {
      lines.push(
        [
          fmtIsoDate(r.date),
          String(r.orders || 0),
          String(r.items || 0),
          String(Number(r.total || 0).toFixed(2)).replace('.', ',')
        ].join(sep)
      );
    });
  } else if (viewSafe === 'customer') {
    lines.push(['cliente', 'cupons', 'itens', 'total'].join(sep));
    (data.detailByCustomer || []).forEach((r) => {
      lines.push(
        [
          (r.customer || 'CONSUMIDOR FINAL').replace(/;/g, ','),
          String(r.orders || 0),
          String(r.items || 0),
          String(Number(r.total || 0).toFixed(2)).replace('.', ',')
        ].join(sep)
      );
    });
  } else if (viewSafe === 'coupon') {
    lines.push(['data', 'cupom', 'cliente', 'itens', 'total'].join(sep));
    (data.detailBySale || []).forEach((r) => {
      lines.push(
        [
          fmtIsoDate(r.date),
          (r.couponNumber || '').toString().replace(/;/g, ','),
          (r.customer || 'CONSUMIDOR FINAL').replace(/;/g, ','),
          String(r.items || 0),
          String(Number(r.total || 0).toFixed(2)).replace('.', ',')
        ].join(sep)
      );
    });
  }

  return lines.join('\n');
}

const generationPdvSalesReportPdf = {
  generatePdvSalesReportPdf,
  generatePdvSalesReportCsv
};

export default generationPdvSalesReportPdf;
