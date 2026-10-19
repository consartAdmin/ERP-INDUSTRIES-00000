// ╔══════════════════════════════════════════════════════════════════════╗
// ║ 🧾 generationSalesReportPdf.js — PDF Relatório de Vendas (ESM)       ║
// ║ Caminho: backend/generationPdf/generationSalesReportPdf.js           ║
// ║ - Gera Buffer de PDF com base no salesReportApi                      ║
// ║ - Usa dados de orders + orderItems (módulo orders)                  ║
// ║ - Suporta modos: full | products | customers | orders                ║
// ║ - Layout A4 paisagem + gráficos de barras                            ║
// ║ - ✅ Updates: sellerId + costMode (current | saleDay)                ║
// ║ - ✅ Orders: cada pedido em um BOX com tabela interna                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import PDFDocument from 'pdfkit';
import { getFullSalesReport } from '../repositories/salesReport/salesReport.index.js';

// ----------------------------------------------------------------------
// Helpers básicos
// ----------------------------------------------------------------------
const moneyBR = (v) =>
  Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

function formatDateBR(d) {
  if (!d) return '-';
  try {
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return String(d);
    return date.toLocaleDateString('pt-BR');
  } catch {
    return String(d);
  }
}

// ✅ melhor label do "byDay" para gráfico (não estoura largura)
function formatDayShort(d) {
  if (!d) return '-';
  try {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return String(d).slice(0, 10);
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}`;
  } catch {
    return String(d).slice(0, 10);
  }
}

function getCostModeLabel(costMode) {
  return costMode === 'saleDay' ? 'Dia da venda' : 'Atual';
}

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function ensureSpace(doc, neededHeight) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  const available = bottom - doc.y;
  if (neededHeight > available) doc.addPage();
}

// (opcional) se você quiser usar no controller pra filename
export function buildPdfFileSuffix({ mode = 'full', costMode = 'current' } = {}) {
  const m =
    mode === 'products'
      ? 'produtos'
      : mode === 'customers'
      ? 'clientes'
      : mode === 'orders'
      ? 'pedidos'
      : 'completo';

  const c = costMode === 'saleDay' ? 'custo-dia-venda' : 'custo-atual';
  return `${m}-${c}`;
}

/**
 * Desenha um título de seção com linha abaixo
 */
function drawSectionTitle(doc, text) {
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#111111').text(text);

  doc.moveDown(0.2);

  doc
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .strokeColor('#cbd5e1')
    .lineWidth(0.6)
    .stroke();

  doc.moveDown(0.4);
}

/**
 * Desenha cabeçalho de tabela com faixa e grid
 */
function drawTableHeader(doc, headers) {
  const topY = doc.y;
  const fullWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  doc.rect(doc.page.margins.left, topY - 2, fullWidth, 16).fill('#e5edf6');

  doc.fontSize(9).font('Helvetica-Bold').fillColor('#111827');
  headers.forEach((h) => doc.text(h.label, h.x, topY, { width: h.w }));

  doc
    .moveTo(doc.page.margins.left, topY + 16)
    .lineTo(doc.page.width - doc.page.margins.right, topY + 16)
    .strokeColor('#cbd5e1')
    .lineWidth(0.4)
    .stroke();

  doc.y = topY + 18;
}

/**
 * Gráfico de barras simples (horizontal)
 * - labelInside = true -> escreve o label dentro da barra
 */
function drawBarChart(doc, data, opts = {}) {
  const {
    x = doc.page.margins.left,
    y = doc.y,
    width = 400,
    height = 160,
    valueKey = 'total_amount',
    labelKey = 'label',
    maxBars = 8,
    title = '',
    valueFormatter = (v) => moneyBR(v),
    labelWidth = 40,
    labelInside = false,
    labelFormatter = (raw) => String(raw ?? ''),
  } = opts;

  const rows = (data || [])
    .slice()
    .filter((r) => Number(r[valueKey] || 0) > 0)
    .sort((a, b) => Number(b[valueKey] || 0) - Number(a[valueKey] || 0))
    .slice(0, maxBars);

  if (!rows.length) {
    doc
      .fontSize(9)
      .font('Helvetica-Oblique')
      .fillColor('#6b7280')
      .text('Sem dados suficientes para o gráfico.', x, y);
    doc.moveDown(0.4);
    return;
  }

  const chartTop = y + 18;
  let chartLeft;
  let chartWidth;

  if (labelInside) {
    chartLeft = x + 10;
    chartWidth = width - 30;
  } else {
    chartLeft = x + labelWidth + 10;
    chartWidth = width - (labelWidth + 30);
  }

  const chartHeight = height - 40;

  // Título do gráfico
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#111827').text(title, x, y, {
    width,
    align: 'left',
  });

  // Moldura
  doc
    .roundedRect(chartLeft, chartTop, chartWidth, chartHeight, 4)
    .strokeColor('#cbd5e1')
    .lineWidth(0.6)
    .stroke();

  const maxVal = Math.max(...rows.map((r) => Number(r[valueKey] || 0))) || 1;
  const barGap = 6;
  const barAreaHeight = chartHeight - 20;
  const barHeight = Math.max(6, (barAreaHeight - barGap * (rows.length - 1)) / rows.length);

  // Grid vertical leve
  const gridLines = 4;
  for (let i = 1; i <= gridLines; i++) {
    const gx = chartLeft + (chartWidth / gridLines) * i;
    doc
      .moveTo(gx, chartTop)
      .lineTo(gx, chartTop + chartHeight)
      .strokeColor('#e5e7eb')
      .lineWidth(0.3)
      .dash(2, { space: 2 })
      .stroke()
      .undash();
  }

  // Barras
  let currentY = chartTop + 10;
  rows.forEach((r) => {
    const raw = labelFormatter(r[labelKey]);
    const rawLabel = String(raw ?? '').trim() || '-';

    const value = Number(r[valueKey] || 0);
    const ratio = value / maxVal;
    const barW = ratio * (chartWidth - 80);

    const barX = chartLeft + 4;
    const barY = currentY - 2;

    // Fundo da barra
    doc.roundedRect(barX, barY, Math.max(barW, 1), barHeight, 3).fill('#60a5fa');

    // Texto do label
    if (labelInside) {
      const minForInside = 60;
      if (barW >= minForInside) {
        const maxChars = Math.max(5, Math.floor((barW - 10) / 4));
        let labelText = rawLabel;
        if (labelText.length > maxChars) labelText = labelText.slice(0, maxChars - 1) + '…';

        doc.font('Helvetica').fontSize(8).fillColor('#ffffff').text(labelText, barX + 4, currentY - 1, {
          width: barW - 8,
        });
      } else {
        doc.font('Helvetica').fontSize(8).fillColor('#111827').text(rawLabel, barX + barW + 4, currentY - 1, {
          width: chartWidth - barW - 10,
        });
      }
    } else {
      doc.font('Helvetica').fontSize(8).fillColor('#111827').text(rawLabel, x, currentY - 1, {
        width: labelWidth,
        align: 'right',
        lineBreak: false,
      });
    }

    // Valor no final da barra
    doc.fillColor('#0f172a').fontSize(7.5).text(valueFormatter(value), barX + barW + 4, currentY - 1, {
      width: 70,
      align: 'left',
    });

    currentY += barHeight + barGap;
  });

  doc.y = chartTop + chartHeight + 8;
}

// ----------------------------------------------------------------------
// Orders BOX (cada pedido em um “container”)
// ----------------------------------------------------------------------
function drawOrderBox(doc, x, y, w, h) {
  doc.roundedRect(x, y, w, h, 8).strokeColor('#cbd5e1').lineWidth(0.8).stroke();
}

function drawOrderHeader(doc, x, y, w, order, opts = {}) {
  const { cont = false } = opts;

  const orderNo =
    order.order_number ||
    order.orderNo ||
    order.order_id ||
    order.id ||
    '-';

  const date = formatDateBR(order.created_at || order.date || order.createdAt);
  const customer = order.customer_name || order.customerName || '-';

  doc.rect(x, y, w, 22).fill('#eff6ff');

  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor('#0f172a')
    .text(
      `Pedido ${orderNo}${cont ? ' (cont.)' : ''}  •  ${date}  •  Cliente: ${customer}`,
      x + 10,
      y + 6,
      { width: w - 20, lineBreak: false, ellipsis: true },
    );

  doc
    .moveTo(x, y + 22)
    .lineTo(x + w, y + 22)
    .strokeColor('#cbd5e1')
    .lineWidth(0.6)
    .stroke();
}

function drawOrderTotalsLine(doc, x, y, w, order) {
  const totalAmount = safeNum(order.total_amount ?? order.totalAmount ?? order.total_sold);
  const totalCost = safeNum(order.total_cost ?? order.totalCost ?? order.total_cost_amount);
  const grossProfit =
    order.gross_profit != null
      ? safeNum(order.gross_profit)
      : safeNum(order.grossProfit ?? totalAmount - totalCost);

  const sold = moneyBR(totalAmount);
  const cost = moneyBR(totalCost);
  const profit = moneyBR(grossProfit);

  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#334155')
    .text(`Total vendido: ${sold}   |   Custo total: ${cost}   |   Lucro bruto: ${profit}`, x + 10, y, {
      width: w - 20,
      lineBreak: false,
      ellipsis: true,
    });
}

function normalizeOrderItems(order) {
  const items =
    order?.items ||
    order?.order_items ||
    order?.orderItems ||
    order?.itens ||
    order?.orderItens ||
    [];
  return Array.isArray(items) ? items : [];
}

function renderOrderBlock(doc, order, items, opts = {}) {
  const x = opts.x ?? doc.page.margins.left;
  const w = opts.w ?? (doc.page.width - doc.page.margins.left - doc.page.margins.right);

  const rowH = 14;
  const headerH = 22;
  const totalsH = 16;
  const tableHeaderH = 18;
  const padTop = 10;
  const padBottom = 10;
  const gapAfter = 14;

  const rows = Array.isArray(items) ? items : [];

  // ✅ colunas que cabem no A4 landscape
  const innerX = x + 10;
  const innerW = w - 20;

  const col = [];
  let cx = innerX;
  const push = (label, width) => {
    col.push({ label, x: cx, w: width });
    cx += width;
  };

  // soma base ~700 (sobra para padding)
  push('SKU', 70);
  push('Descrição', 290);
  push('U.M', 35);
  push('Qtde', 35);
  push('Custo unit.', 60);
  push('Venda unit.', 60);
  push('Total custo', 70);
  push('Total vendido', 70);
  push('Lucro bruto', 70);

  // distribui sobra na descrição
  const used = col.reduce((a, c) => a + c.w, 0);
  const sobra = Math.max(0, innerW - used);
  if (sobra > 0) col[1].w += sobra;

  // -------------------------------
  // Helpers internos
  // -------------------------------
  const bottom = () => doc.page.height - doc.page.margins.bottom;

  function drawTableHeaderInside(boxX, boxW, yHeader) {
    doc.rect(boxX, yHeader, boxW, 18).fill('#e5edf6');

    doc.fontSize(9).font('Helvetica-Bold').fillColor('#111827');
    col.forEach((c) => doc.text(c.label, c.x, yHeader + 4, { width: c.w }));

    doc
      .moveTo(boxX, yHeader + 18)
      .lineTo(boxX + boxW, yHeader + 18)
      .strokeColor('#cbd5e1')
      .lineWidth(0.4)
      .stroke();
  }

  function drawRows(startY, chunkRows, boxX, boxW) {
    let y = startY;
    doc.font('Helvetica').fontSize(9).fillColor('#111827');

    if (!chunkRows.length) {
      doc.font('Helvetica-Oblique').fillColor('#6b7280').text('Sem itens.', boxX + 10, y, { width: boxW - 20 });
      return y + rowH;
    }

    chunkRows.forEach((it, idx) => {
      if (idx % 2 === 0) {
        doc.rect(boxX + 1, y - 1, boxW - 2, rowH).fill('#f9fafb');
        doc.fillColor('#111827');
      }

      const sku = it.product_sku || it.sku || it.product_code || it.productCode || '-';
      const desc = it.product_description || it.description || it.productDescription || '(Sem descrição)';
      const unit = it.product_unit || it.unit || it.um || it.uom || '';
      const qty = Number(it.qty ?? it.quantity ?? it.total_items ?? it.totalItems ?? 0) || 0;

      const totalCost = Number(it.total_cost ?? it.totalCost ?? 0) || 0;
      const totalSold = Number(it.total_amount ?? it.totalAmount ?? 0) || 0;

      const unitCost = qty > 0 ? totalCost / qty : Number(it.unit_cost ?? it.unitCost ?? 0) || 0;
      const unitPrice = qty > 0 ? totalSold / qty : Number(it.unit_price ?? it.unitPrice ?? 0) || 0;

      const profit =
        it.gross_profit != null ? Number(it.gross_profit) :
        (it.grossProfit != null ? Number(it.grossProfit) :
        (totalSold - totalCost));

      doc.fontSize(9).font('Helvetica').fillColor('#111827');
      doc.text(String(sku), col[0].x, y, { width: col[0].w, lineBreak: false, ellipsis: true });
      doc.fontSize(8).text(String(desc), col[1].x, y, { width: col[1].w, lineBreak: false, ellipsis: true });
      doc.fontSize(9).text(String(unit), col[2].x, y, { width: col[2].w, lineBreak: false });
      doc.text(String(qty), col[3].x, y, { width: col[3].w, lineBreak: false });
      doc.text(moneyBR(unitCost), col[4].x, y, { width: col[4].w, lineBreak: false });
      doc.text(moneyBR(unitPrice), col[5].x, y, { width: col[5].w, lineBreak: false });
      doc.text(moneyBR(totalCost), col[6].x, y, { width: col[6].w, lineBreak: false });
      doc.text(moneyBR(totalSold), col[7].x, y, { width: col[7].w, lineBreak: false });
      doc.text(moneyBR(profit), col[8].x, y, { width: col[8].w, lineBreak: false });

      y += rowH;
    });

    return y;
  }

  // -------------------------------
  // Cálculo de chunk por página
  // -------------------------------
  // Altura fixa dentro do box (sem rows)
  const fixedH = padTop + headerH + totalsH + tableHeaderH + padBottom;
  const maxBodyHPerPage = () => {
    const avail = (bottom() - doc.y) - (fixedH + gapAfter);
    return Math.max(0, avail);
  };

  // Se NÃO cabe nem o mínimo, pula página antes de começar o box ✅
  if (maxBodyHPerPage() < rowH) doc.addPage();

  // Quantas linhas cabem nesta página (por box)
  const rowsFitHere = () => Math.max(1, Math.floor(maxBodyHPerPage() / rowH));

  // Se cabe tudo em uma página -> 1 box, “red square” perfeito
  const fitsAllNow = rows.length <= rowsFitHere();

  // Função que desenha 1 box com um chunk
  function drawOneBox(chunkRows, isCont) {
    const chunkBodyH = Math.max(1, chunkRows.length) * rowH;
    const boxH = fixedH + chunkBodyH;

    ensureSpace(doc, boxH + gapAfter);

    const topY = doc.y;

    drawOrderBox(doc, x, topY, w, boxH);
    drawOrderHeader(doc, x, topY, w, order, { cont: isCont });
    drawOrderTotalsLine(doc, x, topY + headerH + 6, w, order);

    const tableHeaderY = topY + headerH + totalsH + 8;
    drawTableHeaderInside(x, w, tableHeaderY);

    const bodyStartY = tableHeaderY + 20;
    const endY = drawRows(bodyStartY, chunkRows, x, w);

    // cursor depois do box
    doc.y = topY + boxH + gapAfter;
    return endY;
  }

  if (fitsAllNow) {
    drawOneBox(rows, false);
    return;
  }

  // Caso grande: quebra em múltiplos boxes (1 por página) ✅
  let cursor = 0;
  let pageIndex = 0;

  while (cursor < rows.length) {
    // garante que cada box começa “limpo” se não couber
    if (maxBodyHPerPage() < rowH) doc.addPage();

    const take = rowsFitHere();
    const chunk = rows.slice(cursor, cursor + take);

    drawOneBox(chunk, pageIndex > 0);

    cursor += take;
    pageIndex += 1;
  }
}

// ----------------------------------------------------------------------
// PDF principal
// ----------------------------------------------------------------------
export async function generateSalesReportPdf(filters = {}, mode = 'full') {
  const data = await getFullSalesReport(filters);

  const modeSafe = ['full', 'products', 'customers', 'orders'].includes(mode) ? mode : 'full';

  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 40,
    info: {
      Title: 'Relatório de Vendas - CONSART ERP',
      Author: 'CONSART ERP',
      Subject: 'Relatório consolidado de vendas',
    },
  });

  const chunks = [];

  return await new Promise((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const startX = doc.page.margins.left;

    // -------------------------------------------------------------------
    // Cabeçalho
    // -------------------------------------------------------------------
    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .fillColor('#0f172a')
      .text('CONSART ERP', startX, doc.page.margins.top - 20, { align: 'left' });

    let subtitle = 'Relatório de Vendas';
    if (modeSafe === 'products') subtitle = 'Relatório de Vendas por Produto';
    if (modeSafe === 'customers') subtitle = 'Relatório de Vendas por Cliente';
    if (modeSafe === 'orders') subtitle = 'Relatório de Vendas por Pedido';

    doc.moveDown(0.1).fontSize(11).font('Helvetica').fillColor('#374151').text(subtitle);

    const periodStart = filters.dateStart || 'Últimos 30 dias';
    const periodEnd = filters.dateEnd || '';

    doc
      .moveDown(0.4)
      .fontSize(9)
      .fillColor('#4b5563')
      .text(`Período: ${formatDateBR(periodStart)}${periodEnd ? ' até ' + formatDateBR(periodEnd) : ''}`);

    // filtros no cabeçalho
    if (filters.sellerId) doc.text(`Filtro Vendedor ID: ${filters.sellerId}`);
    if (filters.customerId) doc.text(`Filtro Cliente ID: ${filters.customerId}`);
    if (filters.productId) doc.text(`Filtro Produto (SKU/descrição): ${filters.productId}`);

    // modo de custo
    doc.text(`Modo de Custo: ${getCostModeLabel(filters.costMode)}`);

    doc.moveDown(0.5);

    doc
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .strokeColor('#cbd5e1')
      .lineWidth(0.8)
      .stroke();

    doc.moveDown(0.8);

    // -------------------------------------------------------------------
    // KPIs / Resumo
    // -------------------------------------------------------------------
    const summary = data.summary || {};
    const ordersCount = safeNum(summary.orders_count || 0);
    const itemsCount = safeNum(summary.total_items || 0);
    const totalAmount = safeNum(summary.total_amount || 0);
    const totalCost = safeNum(summary.total_cost || 0);

    const grossProfit =
      summary.gross_profit != null && !Number.isNaN(Number(summary.gross_profit))
        ? safeNum(summary.gross_profit)
        : totalAmount - totalCost;

    const ticket = ordersCount > 0 ? totalAmount / ordersCount : 0;
    const grossMargin = totalAmount > 0 ? (grossProfit / totalAmount) * 100 : 0;

    drawSectionTitle(doc, 'Resumo Geral');

    const cardW = 150;
    const yCards = doc.y;
    const gap = 10;

    const cards = [
      { label: 'Total vendido', value: moneyBR(totalAmount) },
      { label: 'Custo total', value: moneyBR(totalCost) },
      { label: 'Lucro bruto', value: moneyBR(grossProfit) },
      { label: 'Margem bruta', value: `${grossMargin.toFixed(1)}%` },
      { label: 'Pedidos', value: String(ordersCount) },
      { label: 'Itens vendidos', value: String(itemsCount) },
      { label: 'Ticket médio', value: moneyBR(ticket) },
    ];

    doc.font('Helvetica');
    cards.forEach((c, idx) => {
      const col = idx % 4;
      const row = Math.floor(idx / 4);
      const x = startX + col * (cardW + gap);
      const y = yCards + row * 40;

      doc.roundedRect(x, y, cardW, 34, 6).fillAndStroke('#f9fafb', '#e5e7eb');

      doc.fontSize(8).fillColor('#6b7280').text(c.label, x + 8, y + 5, { width: cardW - 16 });

      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#111827')
        .text(c.value, x + 8, y + 16, { width: cardW - 16 });
    });

    doc.y = yCards + 80;
    doc.moveDown(0.8);

    // ===================================================================
    // GRÁFICOS
    // ===================================================================
    const byDay = data.byDay || [];
    const byCustomer = data.byCustomer || [];
    const byProductRaw = data.byProduct || [];
    const byProduct = byProductRaw.map((r) => ({
      ...r,
      product_label: `${r.product_description || ''}${r.product_unit ? ` (${r.product_unit})` : ''}`.trim(),
    }));

    if (modeSafe === 'full') {
      // Gráfico 1: Vendas por Dia
      drawBarChart(doc, byDay, {
        x: startX,
        y: doc.y,
        width: 360,
        height: 170,
        valueKey: 'total_amount',
        labelKey: 'day',
        title: 'Vendas por Dia',
        valueFormatter: (v) => moneyBR(v),
        labelWidth: 50,
        labelInside: false,
        labelFormatter: (d) => formatDayShort(d),
      });

      const yAfterFirst = doc.y;
      doc.y = yCards + 80;

      // Gráfico 2: Top Clientes
      drawBarChart(doc, byCustomer, {
        x: startX + 380,
        y: doc.y,
        width: 360,
        height: 170,
        valueKey: 'total_amount',
        labelKey: 'customer_name',
        title: 'Top Clientes (por faturamento)',
        valueFormatter: (v) => moneyBR(v),
        labelWidth: 90,
        labelInside: false,
      });

      doc.y = Math.max(yAfterFirst, doc.y) + 10;
    } else if (modeSafe === 'customers') {
      drawBarChart(doc, byCustomer, {
        x: startX,
        y: doc.y,
        width: 500,
        height: 190,
        valueKey: 'total_amount',
        labelKey: 'customer_name',
        title: 'Top Clientes (por faturamento)',
        valueFormatter: (v) => moneyBR(v),
        labelWidth: 120,
        labelInside: false,
      });
      doc.moveDown(0.6);
    } else if (modeSafe === 'products') {
      const byProductForChart = (byProduct || []).map((r) => ({
        ...r,
        label_for_chart: `${r.product_description || 'Produto'}${r.product_unit ? ` (${r.product_unit})` : ''}`,
      }));

      drawBarChart(doc, byProductForChart, {
        x: startX,
        y: doc.y,
        width: 500,
        height: 190,
        valueKey: 'total_amount',
        labelKey: 'label_for_chart',
        title: 'Top Produtos (por faturamento)',
        valueFormatter: (v) => moneyBR(v),
        labelInside: true,
        labelFormatter: (s) => String(s ?? ''),
      });

      doc.moveDown(0.6);
    }

    if (doc.y > doc.page.height - 180) doc.addPage();
    else doc.moveDown(0.5);

    // ===================================================================
    // PEDIDOS EM BOX (mode = orders)
    // ===================================================================
    if (modeSafe === 'orders') {
      const orders = data.orders || data.byOrders || data.byOrder || [];

      drawSectionTitle(doc, 'Pedidos');

      if (!Array.isArray(orders) || orders.length === 0) {
        doc.fontSize(9).font('Helvetica-Oblique').fillColor('#6b7280').text('Sem pedidos no período.');
      } else {
        orders.forEach((o) => {
          const items = normalizeOrderItems(o);
          renderOrderBlock(doc, o, items, {
            x: doc.page.margins.left,
            w: doc.page.width - doc.page.margins.left - doc.page.margins.right,
          });
        });
      }

      // Rodapé
      doc.moveDown(0.8);
      doc
        .fontSize(8)
        .font('Helvetica-Oblique')
        .fillColor('#6b7280')
        .text(`Gerado em ${new Date().toLocaleString('pt-BR')} pelo CONSART ERP`, {
          align: 'right',
        });

      doc.end();
      return; // ✅ não cai nas tabelas normais
    }

    // ===================================================================
    // TABELAS
    // ===================================================================

    // ---- Tabela por Dia (apenas em FULL)
    if (modeSafe === 'full') {
      drawSectionTitle(doc, 'Vendas por Dia');

      const colDay = [
        { label: 'Data', x: startX, w: 90 },
        { label: 'Pedidos', x: startX + 90, w: 70 },
        { label: 'Itens', x: startX + 165, w: 70 },
        { label: 'Total vendido', x: startX + 240, w: 120 },
      ];

      if (!Array.isArray(byDay) || byDay.length === 0) {
        doc.fontSize(9).font('Helvetica-Oblique').fillColor('#6b7280').text('Sem registros no período.');
      } else {
        drawTableHeader(doc, colDay);
        doc.font('Helvetica').fontSize(9).fillColor('#111827');

        const rowH = 14;
        const zebraX = doc.page.margins.left;
        const zebraW = doc.page.width - doc.page.margins.left - doc.page.margins.right;

        byDay.forEach((r, idx) => {
          if (doc.y > doc.page.height - 80) {
            doc.addPage();
            drawSectionTitle(doc, 'Vendas por Dia (cont.)');
            drawTableHeader(doc, colDay);
            doc.font('Helvetica').fontSize(9).fillColor('#111827');
          }

          const y = doc.y;

          if (idx % 2 === 0) {
            doc.rect(zebraX, y - 1, zebraW, rowH).fill('#f9fafb');
            doc.fillColor('#111827');
          }

          const day = r.day ? formatDateBR(r.day) : '-';
          doc.text(day, colDay[0].x, y, { width: colDay[0].w, lineBreak: false });
          doc.text(String(r.orders_count ?? 0), colDay[1].x, y, { width: colDay[1].w, lineBreak: false });
          doc.text(String(r.total_items ?? 0), colDay[2].x, y, { width: colDay[2].w, lineBreak: false });
          doc.text(moneyBR(r.total_amount ?? 0), colDay[3].x, y, { width: colDay[3].w, lineBreak: false });

          doc.y = y + rowH;
        });
      }

      doc.moveDown(1.0);
    }

    // ---- Tabela por Cliente (FULL + CUSTOMERS)
    if (modeSafe === 'full' || modeSafe === 'customers') {
      drawSectionTitle(doc, 'Vendas por Cliente (Top)');

      const colCust = [
        { label: 'Cliente', x: startX, w: 520 },
        { label: 'ID', x: startX + 520, w: 60 },
        { label: 'Pedidos', x: startX + 580, w: 70 },
        { label: 'Total vendido', x: startX + 650, w: 140 },
      ];

      if (!Array.isArray(byCustomer) || byCustomer.length === 0) {
        doc.fontSize(9).font('Helvetica-Oblique').fillColor('#6b7280').text('Sem registros.');
      } else {
        drawTableHeader(doc, colCust);
        doc.font('Helvetica').fontSize(9).fillColor('#111827');

        byCustomer.forEach((r, idx) => {
          if (doc.y > doc.page.height - 80) {
            doc.addPage();
            drawSectionTitle(doc, 'Vendas por Cliente (cont.)');
            drawTableHeader(doc, colCust);
            doc.font('Helvetica').fontSize(9).fillColor('#111827');
          }

          const y = doc.y;

          if (idx % 2 === 0) {
            doc
              .rect(
                doc.page.margins.left,
                y - 1,
                doc.page.width - doc.page.margins.left - doc.page.margins.right,
                14,
              )
              .fill('#f9fafb');
            doc.fillColor('#111827');
          }

          const name = r.customer_name || '(Sem nome)';
          const id = r.customer_id ?? '-';

          doc.text(name, colCust[0].x, y, { width: colCust[0].w, lineBreak: false, ellipsis: true });
          doc.text(String(id), colCust[1].x, y, { width: colCust[1].w, lineBreak: false });
          doc.text(String(r.orders_count || 0), colCust[2].x, y, { width: colCust[2].w, lineBreak: false });
          doc.text(moneyBR(r.total_amount || 0), colCust[3].x, y, { width: colCust[3].w, lineBreak: false });

          doc.y = y + 14;
        });
      }

      doc.moveDown(1.0);
    }

    // ---- Tabela por Produto (FULL + PRODUCTS)
    if (modeSafe === 'full' || modeSafe === 'products') {
      drawSectionTitle(doc, 'Vendas por Produto (Top)');

      const colProd = [
        { label: 'SKU', x: startX, w: 70 },
        { label: 'Descrição', x: startX + 70, w: 260 },
        { label: 'U.M', x: startX + 330, w: 40 },
        { label: 'Qtde', x: startX + 370, w: 40 },
        { label: 'Custo unit.', x: startX + 410, w: 65 },
        { label: 'Venda unit.', x: startX + 475, w: 65 },
        { label: 'Total custo', x: startX + 540, w: 75 },
        { label: 'Total vendido', x: startX + 615, w: 75 },
        { label: 'Lucro bruto', x: startX + 690, w: 70 },
      ];

      if (!Array.isArray(byProduct) || byProduct.length === 0) {
        doc.fontSize(9).font('Helvetica-Oblique').fillColor('#6b7280').text('Sem registros.');
      } else {
        drawTableHeader(doc, colProd);
        doc.font('Helvetica').fontSize(9).fillColor('#111827');

        byProduct.forEach((r, idx) => {
          if (doc.y > doc.page.height - 80) {
            doc.addPage();
            drawSectionTitle(doc, 'Vendas por Produto (cont.)');
            drawTableHeader(doc, colProd);
            doc.font('Helvetica').fontSize(9).fillColor('#111827');
          }

          const y = doc.y;

          if (idx % 2 === 0) {
            doc
              .rect(
                doc.page.margins.left,
                y - 1,
                doc.page.width - doc.page.margins.left - doc.page.margins.right,
                14,
              )
              .fill('#f9fafb');
            doc.fillColor('#111827');
          }

          const sku = r.product_sku || r.product_code || r.product_id || '-';
          const unit = r.product_unit || '';
          const desc = r.product_description || '(Sem descrição)';

          const qty = safeNum(r.total_items || 0);
          const totalProdAmount = safeNum(r.total_amount || 0);
          const totalProdCost = safeNum(r.total_cost || 0);

          const unitCost = qty > 0 ? totalProdCost / qty : 0;
          const unitPrice = qty > 0 ? totalProdAmount / qty : 0;

          const grossProdProfit =
            r.gross_profit != null && !Number.isNaN(Number(r.gross_profit))
              ? safeNum(r.gross_profit)
              : totalProdAmount - totalProdCost;

          doc.fontSize(9).font('Helvetica');
          doc.text(sku, colProd[0].x, y, { width: colProd[0].w, lineBreak: false });

          doc.fontSize(8).text(desc, colProd[1].x, y, { width: colProd[1].w, lineBreak: false, ellipsis: true });

          doc.fontSize(9).text(unit, colProd[2].x, y, { width: colProd[2].w, lineBreak: false });

          doc.text(String(qty), colProd[3].x, y, { width: colProd[3].w, lineBreak: false });
          doc.text(moneyBR(unitCost), colProd[4].x, y, { width: colProd[4].w, lineBreak: false });
          doc.text(moneyBR(unitPrice), colProd[5].x, y, { width: colProd[5].w, lineBreak: false });
          doc.text(moneyBR(totalProdCost), colProd[6].x, y, { width: colProd[6].w, lineBreak: false });
          doc.text(moneyBR(totalProdAmount), colProd[7].x, y, { width: colProd[7].w, lineBreak: false });
          doc.text(moneyBR(grossProdProfit), colProd[8].x, y, { width: colProd[8].w, lineBreak: false });

          doc.y = y + 14;
        });
      }
    }

    // Rodapé
    doc.moveDown(1.0);
    doc
      .fontSize(8)
      .font('Helvetica-Oblique')
      .fillColor('#6b7280')
      .text(`Gerado em ${new Date().toLocaleString('pt-BR')} pelo CONSART ERP`, {
        align: 'right',
      });

    doc.end();
  });
}

const generationSalesReportPdf = {
  generateSalesReportPdf,
};

export default generationSalesReportPdf;