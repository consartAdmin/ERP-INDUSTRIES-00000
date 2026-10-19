// ╔══════════════════════════════════════════════════════════════════════╗
// ║ generationInventoryReportsPdf.js                                    ║
// ║ PDF Report — Inventário / Importação de Inventário                  ║
// ║ CONSART ERP | ESM                                                   ║
// ║ ✅ Barcode                                                          ║
// ║ ✅ Estoque anterior                                                  ║
// ║ ✅ Quantidade contada                                                ║
// ║ ✅ Diferença                                                         ║
// ║ ✅ Novo estoque                                                      ║
// ╚══════════════════════════════════════════════════════════════════════╝

import PDFDocument from 'pdfkit';

function safe(value, fallback = '') {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function qty(value) {
  if (value === null || value === undefined || value === '') return '-';

  const n = Number(value);
  if (!Number.isFinite(n)) return safe(value, '-');

  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function calcDifference(row) {
  const diff = row.difference_qty ?? row.difference ?? null;
  if (diff !== null && diff !== undefined && diff !== '') return diff;

  const counted = Number(row.counted_qty ?? row.quantity ?? 0);
  const system = Number(row.system_stock_qty ?? row.previous_stock_qty ?? row.old_stock_qty ?? 0);

  if (!Number.isFinite(counted) || !Number.isFinite(system)) return null;
  return counted - system;
}

function calcNewStock(row) {
  const newStock =
    row.new_stock_qty ??
    row.new_stock ??
    row.stock_after ??
    row.counted_qty ??
    row.quantity ??
    null;

  return newStock;
}

function dateTimeBR(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '-';

  return d.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function drawTitle(doc, title, subtitle = '') {
  doc
    .fillColor('#111827')
    .fontSize(16)
    .font('Helvetica-Bold')
    .text(title, 28, 28, { align: 'left' });

  if (subtitle) {
    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#64748b')
      .text(subtitle, 28, 50);
  }

  doc
    .moveTo(28, 68)
    .lineTo(doc.page.width - 28, 68)
    .strokeColor('#e5e7eb')
    .stroke();
}

function drawSummaryBox(doc, x, y, w, label, value) {
  doc
    .roundedRect(x, y, w, 50, 8)
    .fillAndStroke('#f8fafc', '#e5e7eb');

  doc
    .fillColor('#64748b')
    .fontSize(7.5)
    .font('Helvetica-Bold')
    .text(label, x + 10, y + 9);

  doc
    .fillColor('#111827')
    .fontSize(17)
    .font('Helvetica-Bold')
    .text(String(value ?? 0), x + 10, y + 25);
}

function ensurePage(doc, neededHeight = 70) {
  if (doc.y + neededHeight > doc.page.height - 35) {
    doc.addPage();
    doc.y = 35;
  }
}

function drawSectionHeader(doc, title, count) {
  ensurePage(doc, 42);

  doc.moveDown(0.9);
  const y = doc.y;

  doc
    .roundedRect(28, y, doc.page.width - 56, 25, 6)
    .fillAndStroke('#f1f5f9', '#e5e7eb');

  doc
    .fillColor('#111827')
    .fontSize(9.5)
    .font('Helvetica-Bold')
    .text(`${title} (${count})`, 40, y + 8);

  doc.y = y + 34;
}

function drawTableHeader(doc, columns) {
  ensurePage(doc, 34);

  const y = doc.y;
  const tableX = 28;
  const tableW = doc.page.width - 56;

  doc
    .rect(tableX, y, tableW, 22)
    .fillAndStroke('#111827', '#111827');

  let x = tableX + 4;

  doc
    .fillColor('#ffffff')
    .fontSize(6.7)
    .font('Helvetica-Bold');

  for (const col of columns) {
    doc.text(col.label, x, y + 7, {
      width: col.width,
      align: col.align || 'left',
      ellipsis: true,
    });

    x += col.width;
  }

  doc.y = y + 22;
}

function drawRow(doc, columns, row, index) {
  const rowHeight = 25;
  ensurePage(doc, rowHeight + 10);

  const y = doc.y;
  const tableX = 28;
  const tableW = doc.page.width - 56;
  const bg = index % 2 === 0 ? '#ffffff' : '#f8fafc';

  doc
    .rect(tableX, y, tableW, rowHeight)
    .fillAndStroke(bg, '#e5e7eb');

  let x = tableX + 4;

  doc
    .fillColor('#111827')
    .fontSize(6.6)
    .font('Helvetica');

  for (const col of columns) {
    const value = typeof col.value === 'function'
      ? col.value(row)
      : row[col.key];

    doc.text(safe(value, '-'), x, y + 7, {
      width: col.width,
      align: col.align || 'left',
      ellipsis: true,
    });

    x += col.width;
  }

  doc.y = y + rowHeight;
}

function drawEmpty(doc, message) {
  ensurePage(doc, 40);

  doc
    .fontSize(8)
    .font('Helvetica')
    .fillColor('#64748b')
    .text(message, 40, doc.y + 6);

  doc.moveDown(1);
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function generateInventoryImportReportPdf(payload = {}) {
  const inserted = normalizeArray(payload.inserted);
  const ignored = normalizeArray(payload.ignored);
  const errors = normalizeArray(payload.errors);

  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 28,
    bufferPages: true,
    info: {
      Title: 'Relatório de Inventário',
      Author: 'CONSART ERP',
      Subject: 'Inventário',
    },
  });

  drawTitle(
    doc,
    'Relatório de Inventário',
    `Gerado em ${dateTimeBR(new Date())}`
  );

  doc.y = 82;

  const boxW = 170;
  drawSummaryBox(doc, 28, 82, boxW, 'ITENS INSERIDOS', inserted.length);
  drawSummaryBox(doc, 218, 82, boxW, 'ITENS IGNORADOS', ignored.length);
  drawSummaryBox(doc, 408, 82, boxW, 'ERROS', errors.length);

  doc.y = 150;

  doc
    .fontSize(9)
    .font('Helvetica-Bold')
    .fillColor('#111827')
    .text('Dados da importação / inventário', 28, doc.y);

  doc.moveDown(0.45);

  doc
    .fontSize(8)
    .font('Helvetica')
    .fillColor('#334155')
    .text(`Inventário ID: ${safe(payload.inventory_id, '-')}`)
    .text(`Descrição: ${safe(payload.inventory_description || payload.description, '-')}`)
    .text(`Arquivo: ${safe(payload.filename, '-')}`)
    .text(`Usuário: ${safe(payload.user_name || payload.user, '-')}`);

const insertedColumns = [
  { label: 'Linha', key: 'line', width: 34, align: 'center' },
  { label: 'Barcode', width: 95, value: r => r.barcode || r.product_barcode || r.ean || '-' },
  { label: 'Código', key: 'product_code', width: 70 },
  { label: 'Produto', key: 'product_name', width: 245 },
  { label: 'Unid.', key: 'unit', width: 45 },
  { label: 'Est. Ant.', width: 70, align: 'right', value: r => qty(r.system_stock_qty ?? r.previous_stock_qty ?? r.old_stock_qty) },
  { label: 'Contado', width: 70, align: 'right', value: r => qty(r.counted_qty ?? r.quantity) },
  { label: 'Dif.', width: 65, align: 'right', value: r => qty(calcDifference(r)) },
  { label: 'Novo Est.', width: 70, align: 'right', value: r => qty(calcNewStock(r)) },
];

  const ignoredColumns = [
    { label: 'Linha', key: 'line', width: 35, align: 'center' },
    { label: 'Barcode', key: 'barcode', width: 100 },
    { label: 'Código', key: 'product_code', width: 70 },
    { label: 'Produto', key: 'product_name', width: 220 },
    { label: 'Motivo', key: 'reason', width: 330 },
  ];

  const errorColumns = [
    { label: 'Linha', key: 'line', width: 35, align: 'center' },
    { label: 'Barcode', key: 'barcode', width: 100 },
    { label: 'Código', key: 'product_code', width: 70 },
    { label: 'Erro', width: 550, value: r => r.error || r.message || r.reason || '-' },
  ];

  drawSectionHeader(doc, 'Itens Inseridos', inserted.length);
  if (inserted.length) {
    drawTableHeader(doc, insertedColumns);
    inserted.forEach((row, index) => drawRow(doc, insertedColumns, row, index));
  } else {
    drawEmpty(doc, 'Nenhum item inserido.');
  }

  drawSectionHeader(doc, 'Itens Ignorados', ignored.length);
  if (ignored.length) {
    drawTableHeader(doc, ignoredColumns);
    ignored.forEach((row, index) => drawRow(doc, ignoredColumns, row, index));
  } else {
    drawEmpty(doc, 'Nenhum item ignorado.');
  }

  drawSectionHeader(doc, 'Erros', errors.length);
  if (errors.length) {
    drawTableHeader(doc, errorColumns);
    errors.forEach((row, index) => drawRow(doc, errorColumns, row, index));
  } else {
    drawEmpty(doc, 'Nenhum erro encontrado.');
  }

  const range = doc.bufferedPageRange();

  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);

    doc
      .fontSize(7)
      .fillColor('#64748b')
      .font('Helvetica')
      .text(
        `CONSART ERP — Inventário | Página ${i + 1} de ${range.count}`,
        28,
        doc.page.height - 24,
        { align: 'center', width: doc.page.width - 56 }
      );
  }

  doc.end();

  return doc;
}

export default generateInventoryImportReportPdf;