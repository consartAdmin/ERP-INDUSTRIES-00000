'use strict';

import PDFDocument from 'pdfkit';

const COLORS = {
  navy: '#17365D', blue: '#DCE6F1', border: '#A6A6A6',
  text: '#1F2937', muted: '#6B7280', warning: '#FFF2CC',
};

const COLUMNS = [
  ['sku', 'SKU', 60, 'left'],
  ['description', 'Produto', 218, 'left'],
  ['movement_type', 'Movimento', 60, 'center'],
  ['invoice_number', 'Nº NF-e', 66, 'center'],
  ['movement_date', 'Data', 66, 'center'],
  ['movement_quantity', 'Qtd. por operação', 92, 'right'],
  ['balance', 'Antes / Depois', 104, 'center'],
  ['quantity_to_buy', 'Comprar', 74, 'right'],
];

const number = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasValue(value) {
  return value !== null && value !== undefined && value !== '';
}

function dateBR(value) {
  if (!value) return '-';
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${date.getUTCFullYear()}`;
}

function movementLabel(value) {
  const normalized = String(value || 'TOTAL').trim().toUpperCase();
  if (['SAIDA', 'SAÍDA', 'OUTBOUND'].includes(normalized)) return 'Saída';
  if (['ENTRADA', 'INBOUND'].includes(normalized)) return 'Entrada';
  return 'Total';
}

function valueFor(row, key) {
  if (key === 'movement_date') return dateBR(row.movement_date);
  if (key === 'movement_type') return movementLabel(row.movement_type);
  if (key === 'balance') {
    if (!hasValue(row.stock_before) && !hasValue(row.stock_after)) return '-';
    return `${hasValue(row.stock_before) ? number.format(num(row.stock_before)) : '-'} / ${hasValue(row.stock_after) ? number.format(num(row.stock_after)) : '-'}`;
  }
  if (['sku', 'description', 'invoice_number'].includes(key)) return String(row[key] ?? '-');
  if (!hasValue(row[key])) return '-';
  return number.format(num(row[key]));
}

function drawCell(doc, text, x, y, width, height, align = 'left', fill = null) {
  if (fill) doc.rect(x, y, width, height).fill(fill);
  doc.rect(x, y, width, height).stroke(COLORS.border);
  doc.fillColor(COLORS.text).font('Helvetica').fontSize(6.5)
    .text(String(text), x + 3, y + 5, { width: width - 6, height: height - 6, align, ellipsis: true });
}

function drawTableHeader(doc, x, y) {
  let cursor = x;
  for (const [, label, width, align] of COLUMNS) {
    doc.rect(cursor, y, width, 24).fill(COLORS.navy).stroke(COLORS.border);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(6.5)
      .text(label, cursor + 2, y + 7, { width: width - 4, align });
    cursor += width;
  }
}

export function generateConciliationSalesxStockPdf({ rows = [], summary = {}, filters = {} } = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 22, bufferPages: true });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(15)
      .text('CONCILIAÇÃO ENTRADAS X SAÍDAS', { align: 'center' });
    doc.moveDown(0.25);
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8)
      .text(`Período: ${dateBR(filters.dateStart)} a ${dateBR(filters.dateEnd)}   Produto: ${filters.search || 'Todos'}`, { align: 'center' });

    const cards = [
      ['Produtos vendidos', summary.products_count, false],
      ['Produtos para comprar', summary.products_to_buy, false],
      ['Quantidade vendida', summary.quantity_sold, true],
      ['Quantidade recebida', summary.quantity_inbound, true],
      ['Quantidade a comprar', summary.quantity_to_buy, true],
    ];
    const startX = 22;
    const gap = 5;
    const cardWidth = (doc.page.width - 44 - (gap * (cards.length - 1))) / cards.length;
    cards.forEach(([label, value, decimal], index) => {
      const x = startX + index * (cardWidth + gap);
      const fill = index === cards.length - 1 ? COLORS.warning : COLORS.blue;
      doc.roundedRect(x, 58, cardWidth, 36, 4).fillAndStroke(fill, COLORS.border);
      doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(6.5)
        .text(label, x + 6, 64, { width: cardWidth - 12, align: 'center' });
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10)
        .text(decimal ? number.format(num(value)) : String(Math.trunc(num(value))), x + 6, 78, { width: cardWidth - 12, align: 'center' });
    });

    const tableX = 28;
    let y = 105;
    drawTableHeader(doc, tableX, y);
    y += 24;

    for (const row of rows) {
      if (y + 19 > doc.page.height - 42) {
        doc.addPage();
        y = 25;
        drawTableHeader(doc, tableX, y);
        y += 24;
      }
      let x = tableX;
      for (const [key, , width, align] of COLUMNS) {
        drawCell(doc, valueFor(row, key), x, y, width, 19, align, key === 'quantity_to_buy' ? COLORS.warning : null);
        x += width;
      }
      y += 19;
    }

    const pages = doc.bufferedPageRange();
    for (let index = 0; index < pages.count; index += 1) {
      doc.switchToPage(index);
      doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7)
        .text(`Página ${index + 1} de ${pages.count}`, 22, doc.page.height - doc.page.margins.bottom - 10, {
          width: doc.page.width - 44, align: 'right', lineBreak: false,
        });
    }
    doc.end();
  });
}

export default generateConciliationSalesxStockPdf;
