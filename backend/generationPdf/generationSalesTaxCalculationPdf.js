// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: generationSalesTaxCalculationPdf.js                           ║
// ║ MODULE: SALES TAX CALCULATION                                       ║
// ║ CONSART ERP                                                         ║
// ║ PDF GENERATION                                                      ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function moneyBR(value) {
  return Number(toNumber(value, 0)).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function numberBR(value, digits = 2) {
  return Number(toNumber(value, 0)).toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function formatDateBR(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('pt-BR');
}

function safeText(value) {
  return String(value ?? '').trim();
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function drawSectionTitle(doc, title) {
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor('#1e3a8a')
    .text(title, { align: 'left' });

  doc.moveDown(0.4);
}

function drawKeyValueGrid(doc, items, options = {}) {
  const startX = options.startX ?? doc.page.margins.left;
  const startY = options.startY ?? doc.y;
  const colGap = options.colGap ?? 12;
  const rowGap = options.rowGap ?? 10;
  const cols = options.cols ?? 2;

  const usableWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const boxWidth = (usableWidth - (colGap * (cols - 1))) / cols;
  const boxHeight = options.boxHeight ?? 42;

  let x = startX;
  let y = startY;
  let colIndex = 0;

  items.forEach((item, index) => {
    if (y + boxHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = doc.page.margins.top;
      x = startX;
      colIndex = 0;
    }

    doc
      .roundedRect(x, y, boxWidth, boxHeight, 8)
      .lineWidth(0.6)
      .strokeColor('#dbe3ef')
      .fillAndStroke('#f8fafc', '#dbe3ef');

    doc
      .fillColor('#64748b')
      .font('Helvetica-Bold')
      .fontSize(8)
      .text(item.label, x + 10, y + 8, {
        width: boxWidth - 20,
        align: 'left'
      });

    doc
      .fillColor('#0f172a')
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(item.value, x + 10, y + 20, {
        width: boxWidth - 20,
        align: 'left'
      });

    colIndex += 1;

    if (colIndex >= cols) {
      colIndex = 0;
      x = startX;
      y += boxHeight + rowGap;
    } else {
      x += boxWidth + colGap;
    }

    if (index === items.length - 1 && colIndex !== 0) {
      y += boxHeight + rowGap;
    }
  });

  doc.y = y;
}

function drawSimpleTable(doc, config) {
  const {
    columns,
    rows,
    title,
    rowHeight = 20,
    headerHeight = 22,
    fontSize = 8
  } = config;

  if (title) {
    drawSectionTitle(doc, title);
  }

  const startX = doc.page.margins.left;
  let y = doc.y;
  const usableWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;

  const totalWeight = columns.reduce((sum, col) => sum + col.width, 0);
  const scaledColumns = columns.map(col => ({
    ...col,
    calcWidth: (col.width / totalWeight) * usableWidth
  }));

  function drawHeader() {
    let x = startX;

    if (y + headerHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = doc.page.margins.top;
    }

    scaledColumns.forEach(col => {
      doc
        .rect(x, y, col.calcWidth, headerHeight)
        .fillAndStroke('#eff6ff', '#cbd5e1');

      doc
        .fillColor('#1e3a8a')
        .font('Helvetica-Bold')
        .fontSize(8)
        .text(col.label, x + 4, y + 6, {
          width: col.calcWidth - 8,
          align: col.align || 'left'
        });

      x += col.calcWidth;
    });

    y += headerHeight;
  }

  drawHeader();

  rows.forEach(row => {
    if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = doc.page.margins.top;
      drawHeader();
    }

    let x = startX;

    scaledColumns.forEach((col, colIndex) => {
      doc
        .rect(x, y, col.calcWidth, rowHeight)
        .fillAndStroke(
          row.__zebra ? '#ffffff' : '#f8fafc',
          '#e2e8f0'
        );

      const rawValue = typeof col.value === 'function'
        ? col.value(row)
        : row[col.key];

      doc
        .fillColor('#0f172a')
        .font('Helvetica')
        .fontSize(fontSize)
        .text(String(rawValue ?? ''), x + 4, y + 5, {
          width: col.calcWidth - 8,
          align: col.align || 'left',
          ellipsis: true
        });

      x += col.calcWidth;
    });

    y += rowHeight;
  });

  doc.y = y + 8;
}

export async function generateSalesTaxCalculationPdf(data, outputFilePath) {
  ensureDir(path.dirname(outputFilePath));

  const summary = data?.summary || {};
  const calculations = Array.isArray(data?.calculations) ? data.calculations : [];
  const items = Array.isArray(data?.items) ? data.items : [];
  const reconciliation = Array.isArray(data?.reconciliation) ? data.reconciliation : [];

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 24
    });

    const stream = fs.createWriteStream(outputFilePath);

    doc.pipe(stream);

    doc
      .font('Helvetica-Bold')
      .fontSize(18)
      .fillColor('#0f172a')
      .text('RELATÓRIO DE CÁLCULO DE IMPOSTOS', {
        align: 'left'
      });

    doc
      .moveDown(0.2)
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#64748b')
      .text(
        `Período: ${formatDateBR(data?.date_from)} até ${formatDateBR(data?.date_to)}`,
        { align: 'left' }
      );

    doc.moveDown(0.8);

    drawSectionTitle(doc, 'Resumo Geral');

    drawKeyValueGrid(doc, [
      { label: 'Data Inicial', value: formatDateBR(data?.date_from) },
      { label: 'Data Final', value: formatDateBR(data?.date_to) },
      { label: 'Pedidos Calculados', value: numberBR(summary.calculations_count, 0) },
      { label: 'Venda Bruta', value: moneyBR(summary.gross_total) },
      { label: 'Desconto', value: moneyBR(summary.discount_total) },
      { label: 'Venda Líquida', value: moneyBR(summary.net_total) },
      { label: 'Carga Tributária', value: moneyBR(summary.tax_burden_total) },
      { label: 'Custo Total', value: moneyBR(summary.cost_total) },
      { label: 'Lucro Bruto', value: moneyBR(summary.gross_profit_total) },
      { label: 'Margem (%)', value: `${numberBR(summary.margin_percent, 4)}%` },
      { label: 'ICMS', value: moneyBR(summary.icms_total) },
      { label: 'PIS', value: moneyBR(summary.pis_total) },
      { label: 'COFINS', value: moneyBR(summary.cofins_total) },
      { label: 'IPI', value: moneyBR(summary.ipi_total) },
      { label: 'FCP', value: moneyBR(summary.fcp_total) },
      { label: 'Frete', value: moneyBR(summary.freight_total) }
    ], {
      cols: 4,
      boxHeight: 42
    });

    drawSimpleTable(doc, {
      title: 'Cálculos Recentes',
      columns: [
        { label: 'ID', key: 'sales_tax_calc_id', width: 6, align: 'center' },
        { label: 'Pedido', key: 'order_number', width: 8, align: 'center' },
        { label: 'Data', value: row => formatDateBR(row.issue_date), width: 8, align: 'center' },
        { label: 'Cliente', key: 'customer_name', width: 24 },
        { label: 'Venda Líquida', value: row => moneyBR(row.net_total), width: 12, align: 'right' },
        { label: 'Carga Trib.', value: row => moneyBR(row.tax_burden_total), width: 12, align: 'right' },
        { label: 'Lucro Bruto', value: row => moneyBR(row.gross_profit_total), width: 12, align: 'right' },
        { label: 'Margem', value: row => `${numberBR(row.margin_percent, 4)}%`, width: 10, align: 'right' }
      ],
      rows: calculations.map((row, index) => ({ ...row, __zebra: index % 2 === 0 })),
      rowHeight: 20
    });

    drawSimpleTable(doc, {
      title: 'Itens da Apuração',
      columns: [
        { label: 'SKU', key: 'sku', width: 9 },
        { label: 'Descrição', key: 'description', width: 28 },
        { label: 'Qtd', value: row => numberBR(row.quantity, 3), width: 6, align: 'right' },
        { label: 'Un', key: 'unit', width: 5, align: 'center' },
        { label: 'Unitário', value: row => moneyBR(row.unit_price), width: 9, align: 'right' },
        { label: 'Líquido', value: row => moneyBR(row.net_value), width: 9, align: 'right' },
        { label: 'Custo', value: row => moneyBR(row.cost_total), width: 9, align: 'right' },
        { label: 'ICMS', value: row => moneyBR(row.icms_value), width: 8, align: 'right' },
        { label: 'PIS', value: row => moneyBR(row.pis_value), width: 8, align: 'right' },
        { label: 'COFINS', value: row => moneyBR(row.cofins_value), width: 9, align: 'right' },
        { label: 'IPI', value: row => moneyBR(row.ipi_value), width: 8, align: 'right' },
        { label: 'FCP', value: row => moneyBR(row.fcp_value), width: 8, align: 'right' }
      ],
      rows: items.map((row, index) => ({ ...row, __zebra: index % 2 === 0 })),
      rowHeight: 20,
      fontSize: 7
    });

    drawSimpleTable(doc, {
      title: 'Reconciliação Fiscal',
      columns: [
        { label: 'ID', key: 'reconciliation_id', width: 7, align: 'center' },
        { label: 'Order', key: 'order_id', width: 8, align: 'center' },
        { label: 'Item', key: 'order_item_id', width: 8, align: 'center' },
        { label: 'SKU', key: 'sku', width: 9 },
        { label: 'Divergência', key: 'divergence_type', width: 16 },
        { label: 'Esperado', value: row => row.expected_value == null ? '-' : moneyBR(row.expected_value), width: 10, align: 'right' },
        { label: 'Atual', value: row => row.actual_value == null ? '-' : moneyBR(row.actual_value), width: 10, align: 'right' },
        { label: 'Diferença', value: row => row.difference_value == null ? '-' : moneyBR(row.difference_value), width: 10, align: 'right' },
        { label: 'Status', key: 'status', width: 8, align: 'center' },
        { label: 'Detalhes', value: row => safeText(row.details), width: 24 }
      ],
      rows: reconciliation.map((row, index) => ({ ...row, __zebra: index % 2 === 0 })),
      rowHeight: 20,
      fontSize: 7
    });

    doc.end();

    stream.on('finish', () => resolve(outputFilePath));
    stream.on('error', reject);
  });
}

export default generateSalesTaxCalculationPdf;