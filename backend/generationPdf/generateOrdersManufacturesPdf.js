// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: generateOrdersManufacturesPdf.js                              ║
// ║ MODULE: Manufactures Orders PDF                                     ║
// ║ DESCRIPTION: PDF profissional em paisagem para pedido de fabricante  ║
// ║ CONSART ERP | PDFKit | ESM                                          ║
// ╚══════════════════════════════════════════════════════════════════════╝

import PDFDocument from 'pdfkit';

function moneyBR(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function numberBR(value, decimals = 3) {
  return Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function dateBR(value) {
  if (!value) return '-';

  try {
    return new Date(value).toLocaleString('pt-BR');
  } catch {
    return '-';
  }
}

function safe(value, fallback = '-') {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function statusLabel(status) {
  const map = {
    OPEN: 'ABERTO',
    IN_PROGRESS: 'EM PRODUÇÃO',
    FINISHED: 'FINALIZADO',
    CANCELLED: 'CANCELADO',
  };

  return map[status] || status || '-';
}

function sanitizeFilename(value) {
  return String(value || 'pedido-fabricante')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function calcTotal(items = []) {
  return items.reduce((sum, item) => {
    return sum + Number(item.quantity || 0) * Number(item.cost_price || 0);
  }, 0);
}

function calcSummary(items = []) {
  const totalItems = items.length;
  const totalQty = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const totalCost = calcTotal(items);

  const belowMin = items.filter(item => {
    const stockQty = Number(item.stock_qty || 0);
    const stockMin = Number(item.stock_min || 0);
    return stockMin > 0 && stockQty < stockMin;
  }).length;

  return {
    totalItems,
    totalQty,
    totalCost,
    belowMin,
  };
}

function drawRoundedCard(doc, x, y, w, h, options = {}) {
  const {
    fill = '#ffffff',
    stroke = '#dbe4f0',
    radius = 10,
  } = options;

  doc
    .roundedRect(x, y, w, h, radius)
    .fillAndStroke(fill, stroke);
}

function drawPageHeader(doc, order, ctx) {
  const { left, right, usableWidth } = ctx;

  const y = 28;
  const h = 78;

  doc
    .roundedRect(left, y, usableWidth, h, 12)
    .fill('#0f172a');

  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(20)
    .text('PEDIDO PARA FABRICANTE', left + 22, y + 18);

  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#cbd5e1')
    .text('CONSART ERP - Ordem de produção/compras para fabricante', left + 22, y + 45);

  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor('#ffffff')
    .text(safe(order.order_number), right - 210, y + 20, {
      width: 190,
      align: 'right',
    });

  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#cbd5e1')
    .text(`Emitido em: ${dateBR(new Date())}`, right - 250, y + 48, {
      width: 230,
      align: 'right',
    });
}

function drawInfoAndSummary(doc, order, items, ctx) {
  const { left, usableWidth } = ctx;

  const y = 122;
  const infoW = usableWidth * 0.62;
  const summaryW = usableWidth - infoW - 14;

  drawRoundedCard(doc, left, y, infoW, 108);

  doc
    .fillColor('#0f172a')
    .font('Helvetica-Bold')
    .fontSize(10)
    .text('DADOS DO PEDIDO', left + 14, y + 12);

  const colW = infoW / 3;

  doc.font('Helvetica').fontSize(8).fillColor('#64748b');
  doc.text('Fabricante', left + 14, y + 36);
  doc.text('Status', left + colW + 14, y + 36);
  doc.text('Criado em', left + colW * 2 + 14, y + 36);

  doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a');
  doc.text(safe(order.manufacturer_name), left + 14, y + 50, { width: colW - 22 });
  doc.text(statusLabel(order.status), left + colW + 14, y + 50);
  doc.text(dateBR(order.created_at), left + colW * 2 + 14, y + 50);

  doc.font('Helvetica').fontSize(8).fillColor('#64748b');
  doc.text('Observações', left + 14, y + 76);

  doc.font('Helvetica').fontSize(8).fillColor('#0f172a');
  doc.text(safe(order.notes, '-'), left + 84, y + 76, {
    width: infoW - 100,
    lineGap: 1,
  });

  const sx = left + infoW + 14;
  const summary = calcSummary(items);

  drawRoundedCard(doc, sx, y, summaryW, 108, {
    fill: '#f8fafc',
    stroke: '#dbe4f0',
  });

  doc
    .fillColor('#0f172a')
    .font('Helvetica-Bold')
    .fontSize(10)
    .text('RESUMO OPERACIONAL', sx + 14, y + 12);

  const cardGap = 8;
  const miniW = (summaryW - 28 - cardGap) / 2;

  const cards = [
    ['Itens', summary.totalItems],
    ['Quantidade', numberBR(summary.totalQty, 0)],
    ['Abaixo mín.', summary.belowMin],
    ['Total', moneyBR(summary.totalCost)],
  ];

  cards.forEach((card, index) => {
    const cx = sx + 14 + (index % 2) * (miniW + cardGap);
    const cy = y + 34 + Math.floor(index / 2) * 31;

    doc
      .roundedRect(cx, cy, miniW, 25, 7)
      .fill('#ffffff');

    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor('#64748b')
      .text(card[0], cx + 8, cy + 5);

    doc
      .font('Helvetica-Bold')
      .fontSize(index === 3 ? 8 : 10)
      .fillColor('#0f172a')
      .text(String(card[1]), cx + 8, cy + 15, {
        width: miniW - 14,
        align: index === 3 ? 'right' : 'left',
      });
  });
}

function drawTableHeader(doc, y, ctx) {
  const { left, usableWidth } = ctx;

  doc
    .roundedRect(left, y, usableWidth, 25, 8)
    .fill('#eaf0f7');

  doc
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .fillColor('#334155');

  const cols = getColumns(left);

  doc.text('SKU', cols.sku, y + 8, { width: 58 });
  doc.text('Descrição', cols.description, y + 8, { width: 245 });
  doc.text('U.M', cols.unit, y + 8, { width: 34, align: 'center' });
  doc.text('Estoque', cols.stock, y + 8, { width: 52, align: 'right' });
  doc.text('Mín.', cols.min, y + 8, { width: 45, align: 'right' });
  doc.text('Máx.', cols.max, y + 8, { width: 45, align: 'right' });
  doc.text('Qtd', cols.qty, y + 8, { width: 48, align: 'right' });
  doc.text('Custo', cols.cost, y + 8, { width: 68, align: 'right' });
  doc.text('Total', cols.total, y + 8, { width: 74, align: 'right' });

  return y + 25;
}

function getColumns(left) {
  return {
    sku: left + 8,
    description: left + 72,
    unit: left + 325,
    stock: left + 366,
    min: left + 426,
    max: left + 479,
    qty: left + 532,
    cost: left + 590,
    total: left + 670,
  };
}

function ensureSpace(doc, y, needed, order, ctx) {
  if (y + needed < doc.page.height - 74) return y;

  doc.addPage();
  drawPageHeader(doc, order, ctx);

  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor('#0f172a')
    .text('Produtos do Pedido', ctx.left, 124);

  return drawTableHeader(doc, 146, ctx);
}

function drawItemsTable(doc, order, items, ctx) {
  const { left, right, usableWidth } = ctx;

  let y = 258;

  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor('#0f172a')
    .text('Produtos do Pedido', left, y);

  y += 20;
  y = drawTableHeader(doc, y, ctx);

  const cols = getColumns(left);

  let total = 0;

  items.forEach((item, index) => {
    const qty = Number(item.quantity || 0);
    const cost = Number(item.cost_price || 0);
    const rowTotal = qty * cost;

    const stockQty = Number(item.stock_qty || 0);
    const stockMin = Number(item.stock_min || 0);
    const stockMax = Number(item.stock_max || 0);

    total += rowTotal;

    const description = safe(item.description);
    const rowHeight = Math.max(
      28,
      doc.heightOfString(description, {
        width: 245,
        fontSize: 7.5,
      }) + 12
    );

    y = ensureSpace(doc, y, rowHeight, order, ctx);

    doc
      .rect(left, y, usableWidth, rowHeight)
      .fill(index % 2 === 0 ? '#ffffff' : '#f8fafc');

    if (stockMin > 0 && stockQty < stockMin) {
      doc
        .rect(left, y, 4, rowHeight)
        .fill('#ef4444');
    } else if (stockMax > 0 && stockQty > stockMax) {
      doc
        .rect(left, y, 4, rowHeight)
        .fill('#f97316');
    } else if (stockMin > 0 && stockMax > 0) {
      doc
        .rect(left, y, 4, rowHeight)
        .fill('#22c55e');
    }

    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor('#0f172a');

    doc.text(safe(item.sku || item.product_code), cols.sku, y + 8, { width: 58 });
    doc.text(description, cols.description, y + 8, { width: 245 });
    doc.text(safe(item.unit), cols.unit, y + 8, { width: 34, align: 'center' });
    doc.text(numberBR(stockQty), cols.stock, y + 8, { width: 52, align: 'right' });
    doc.text(numberBR(stockMin), cols.min, y + 8, { width: 45, align: 'right' });
    doc.text(numberBR(stockMax), cols.max, y + 8, { width: 45, align: 'right' });
    doc.text(numberBR(qty, 0), cols.qty, y + 8, { width: 48, align: 'right' });
    doc.text(moneyBR(cost), cols.cost, y + 8, { width: 68, align: 'right' });

    doc
      .font('Helvetica-Bold')
      .text(moneyBR(rowTotal), cols.total, y + 8, { width: 74, align: 'right' });

    doc
      .moveTo(left, y + rowHeight)
      .lineTo(right, y + rowHeight)
      .strokeColor('#edf2f7')
      .lineWidth(0.5)
      .stroke();

    y += rowHeight;
  });

  return { y, total };
}

function drawTotal(doc, y, total, ctx) {
  const { right, left, usableWidth } = ctx;

  y += 16;

  doc
    .moveTo(left, y)
    .lineTo(right, y)
    .strokeColor('#dbe4f0')
    .lineWidth(1)
    .stroke();

  const boxW = 250;
  const boxH = 56;
  const boxX = right - boxW;
  const boxY = y + 18;

  doc
    .roundedRect(boxX, boxY, boxW, boxH, 12)
    .fill('#0f172a');

  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#cbd5e1')
    .text('Total Geral', boxX + 18, boxY + 12);

  doc
    .font('Helvetica-Bold')
    .fontSize(19)
    .fillColor('#ffffff')
    .text(moneyBR(total), boxX + 18, boxY + 29, {
      width: boxW - 36,
      align: 'right',
    });

  return boxY + boxH;
}

function drawFooter(doc, ctx) {
  const { left, usableWidth } = ctx;
  const pages = doc.bufferedPageRange();

  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);

    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor('#94a3b8')
      .text(
        `CONSART ERP - Pedido para Fabricante | Página ${i + 1} de ${pages.count}`,
        left,
        doc.page.height - 34,
        {
          width: usableWidth,
          align: 'center',
        }
      );
  }
}

export function buildOrdersManufacturesPdfStream(order = {}) {
  const items = Array.isArray(order.items) ? order.items : [];

  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 32,
    bufferPages: true,
  });

  const pageWidth = doc.page.width;
  const left = doc.page.margins.left;
  const right = pageWidth - doc.page.margins.right;
  const usableWidth = right - left;

  const ctx = {
    left,
    right,
    usableWidth,
  };

  drawPageHeader(doc, order, ctx);
  drawInfoAndSummary(doc, order, items, ctx);

  const tableResult = drawItemsTable(doc, order, items, ctx);
  drawTotal(doc, tableResult.y, tableResult.total, ctx);

  drawFooter(doc, ctx);

  return doc;
}

export function getOrdersManufacturesPdfFilename(order = {}) {
  return `${sanitizeFilename(order.order_number)}_${sanitizeFilename(order.manufacturer_name)}.pdf`;
}

export default {
  buildOrdersManufacturesPdfStream,
  getOrdersManufacturesPdfFilename,
};