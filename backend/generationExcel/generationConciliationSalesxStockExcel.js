'use strict';

import ExcelJS from 'exceljs';

const NUMBER_FORMAT = '#,##0;[Red]-#,##0';

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasValue(value) {
  return value !== null && value !== undefined && value !== '';
}

function balanceText(row) {
  if (!hasValue(row.stock_before) && !hasValue(row.stock_after)) return '-';
  const before = hasValue(row.stock_before) ? num(row.stock_before).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '-';
  const after = hasValue(row.stock_after) ? num(row.stock_after).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '-';
  return `${before} / ${after}`;
}

function movementLabel(value) {
  const normalized = String(value || 'TOTAL').trim().toUpperCase();
  if (['SAIDA', 'SAÍDA', 'OUTBOUND'].includes(normalized)) return 'Saída';
  if (['ENTRADA', 'INBOUND'].includes(normalized)) return 'Entrada';
  return 'Total';
}

function excelDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12, 0, 0);
  }
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function generateConciliationSalesxStockExcel({ rows = [], summary = {}, filters = {} } = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CONSART ERP';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Conciliação', {
    views: [{ state: 'frozen', ySplit: 8 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  sheet.mergeCells('A1:H1');
  sheet.getCell('A1').value = 'CONCILIAÇÃO ENTRADAS X SAÍDAS';
  sheet.getCell('A1').font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 16 };
  sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17365D' } };
  sheet.getRow(1).height = 26;

  sheet.mergeCells('A2:H2');
  sheet.getCell('A2').value = `Período: ${filters.dateStart || '-'} a ${filters.dateEnd || '-'} | Produto: ${filters.search || 'Todos'}`;
  sheet.getCell('A2').alignment = { horizontal: 'center' };

  const cards = [
    ['Produtos vendidos', summary.products_count, false],
    ['Produtos para comprar', summary.products_to_buy, false],
    ['Quantidade vendida', summary.quantity_sold, true],
    ['Quantidade recebida', summary.quantity_inbound, true],
    ['Estoque disponível', summary.available_stock, true],
    ['Quantidade a comprar', summary.quantity_to_buy, true],
  ];

  const cardRanges = [
    [4, 5, 1, 3], [4, 5, 4, 6], [4, 5, 7, 8],
    [6, 7, 1, 3], [6, 7, 4, 6], [6, 7, 7, 8],
  ];

  cards.forEach(([label, value, decimal], index) => {
    const [labelRow, valueRow, firstColumn, lastColumn] = cardRanges[index];
    sheet.mergeCells(labelRow, firstColumn, labelRow, lastColumn);
    sheet.mergeCells(valueRow, firstColumn, valueRow, lastColumn);
    const labelCell = sheet.getCell(labelRow, firstColumn);
    const valueCell = sheet.getCell(valueRow, firstColumn);
    labelCell.value = label;
    valueCell.value = num(value);
    labelCell.font = { bold: true, color: { argb: 'FF44546A' }, size: 9 };
    valueCell.font = { bold: true, size: 12 };
    valueCell.numFmt = decimal ? NUMBER_FORMAT : '0';
    valueCell.alignment = { horizontal: 'center' };
    labelCell.alignment = { horizontal: 'center' };
    const color = index === cards.length - 1 ? 'FFFFF2CC' : 'FFDCE6F1';
    for (let row = labelRow; row <= valueRow; row += 1) {
      for (let column = firstColumn; column <= lastColumn; column += 1) {
        sheet.getCell(row, column).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
      }
    }
  });

  const header = [
    'SKU', 'Produto', 'Movimento', 'Nº NF-e', 'Data',
    'Quantidade por Operação', 'Antes / Depois', 'Comprar',
  ];
  sheet.getRow(8).values = header;
  const headerRow = sheet.getRow(8);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17365D' } };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  headerRow.height = 30;

  for (const row of rows) {
    const excelRow = sheet.addRow([
      String(row.sku ?? ''),
      row.description ?? '',
      movementLabel(row.movement_type),
      row.invoice_number ?? '',
      excelDate(row.movement_date),
      hasValue(row.movement_quantity) ? num(row.movement_quantity) : null,
      balanceText(row),
      num(row.quantity_to_buy),
    ]);
    excelRow.getCell(5).numFmt = 'dd/mm/yyyy';
    excelRow.getCell(6).numFmt = NUMBER_FORMAT;
    excelRow.getCell(8).numFmt = NUMBER_FORMAT;
    excelRow.getCell(7).alignment = { horizontal: 'center' };
    excelRow.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
  }

  [14, 52, 14, 15, 13, 24, 25, 16].forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
  sheet.autoFilter = { from: 'A8', to: `H${Math.max(sheet.rowCount, 8)}` };
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber < 8) return;
    row.eachCell({ includeEmpty: true }, (cell, column) => {
      if (column > 8) return;
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD9E1F2' } },
        left: { style: 'thin', color: { argb: 'FFD9E1F2' } },
        bottom: { style: 'thin', color: { argb: 'FFD9E1F2' } },
        right: { style: 'thin', color: { argb: 'FFD9E1F2' } },
      };
    });
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export default generateConciliationSalesxStockExcel;
