// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: generationSalesTaxCalculationExcel.js                         ║
// ║ MODULE: SALES TAX CALCULATION                                       ║
// ║ CONSART ERP                                                         ║
// ║ EXCEL GENERATION                                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatDateBR(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('pt-BR');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function applyHeaderStyle(cell) {
  cell.font = { bold: true, color: { argb: 'FF1E3A8A' } };
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFEFF6FF' }
  };
  cell.border = {
    top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
  };
  cell.alignment = { vertical: 'middle', horizontal: 'center' };
}

function applyBodyBorder(cell) {
  cell.border = {
    top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
  };
}

function addSectionTitle(sheet, rowNumber, title) {
  const row = sheet.getRow(rowNumber);
  row.getCell(1).value = title;
  row.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF0F172A' } };
  row.height = 18;
}

export async function generateSalesTaxCalculationExcel(data, outputFilePath) {
  ensureDir(path.dirname(outputFilePath));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'OpenAI';
  workbook.created = new Date();

  const summary = data?.summary || {};
  const calculations = Array.isArray(data?.calculations) ? data.calculations : [];
  const items = Array.isArray(data?.items) ? data.items : [];
  const reconciliation = Array.isArray(data?.reconciliation) ? data.reconciliation : [];

  /* ====================================================================
     RESUMO
  ==================================================================== */
  const wsSummary = workbook.addWorksheet('Resumo');

  wsSummary.columns = [
    { header: 'Campo', key: 'field', width: 28 },
    { header: 'Valor', key: 'value', width: 22 }
  ];

  wsSummary.addRow(['Relatório de Cálculo de Impostos', '']);
  wsSummary.mergeCells('A1:B1');
  wsSummary.getCell('A1').font = { bold: true, size: 14 };
  wsSummary.getCell('A1').alignment = { horizontal: 'left' };

  wsSummary.addRow([]);
  wsSummary.addRow(['Data Inicial', formatDateBR(data?.date_from)]);
  wsSummary.addRow(['Data Final', formatDateBR(data?.date_to)]);
  wsSummary.addRow(['Pedidos Calculados', toNumber(summary.calculations_count, 0)]);
  wsSummary.addRow(['Venda Bruta', toNumber(summary.gross_total)]);
  wsSummary.addRow(['Desconto', toNumber(summary.discount_total)]);
  wsSummary.addRow(['Venda Líquida', toNumber(summary.net_total)]);
  wsSummary.addRow(['Carga Tributária', toNumber(summary.tax_burden_total)]);
  wsSummary.addRow(['Custo Total', toNumber(summary.cost_total)]);
  wsSummary.addRow(['Lucro Bruto', toNumber(summary.gross_profit_total)]);
  wsSummary.addRow(['Margem (%)', toNumber(summary.margin_percent)]);
  wsSummary.addRow(['ICMS', toNumber(summary.icms_total)]);
  wsSummary.addRow(['PIS', toNumber(summary.pis_total)]);
  wsSummary.addRow(['COFINS', toNumber(summary.cofins_total)]);
  wsSummary.addRow(['IPI', toNumber(summary.ipi_total)]);
  wsSummary.addRow(['FCP', toNumber(summary.fcp_total)]);
  wsSummary.addRow(['Frete', toNumber(summary.freight_total)]);

  wsSummary.eachRow((row, rowNumber) => {
    if (rowNumber >= 3) {
      row.eachCell(cell => applyBodyBorder(cell));
    }
  });

  ['B6', 'B7', 'B8', 'B9', 'B10', 'B12', 'B13', 'B14', 'B15', 'B16', 'B17'].forEach(addr => {
    wsSummary.getCell(addr).numFmt = '"R$" #,##0.00';
  });

  wsSummary.getCell('B11').numFmt = '0.0000';

  /* ====================================================================
     CÁLCULOS
  ==================================================================== */
  const wsCalc = workbook.addWorksheet('Calculos');

  wsCalc.columns = [
    { header: 'ID', key: 'sales_tax_calc_id', width: 10 },
    { header: 'Pedido', key: 'order_number', width: 12 },
    { header: 'Data', key: 'issue_date', width: 14 },
    { header: 'Cliente', key: 'customer_name', width: 34 },
    { header: 'Venda Líquida', key: 'net_total', width: 16 },
    { header: 'Carga Tributária', key: 'tax_burden_total', width: 16 },
    { header: 'Lucro Bruto', key: 'gross_profit_total', width: 16 },
    { header: 'Margem (%)', key: 'margin_percent', width: 14 }
  ];

  wsCalc.getRow(1).eachCell(applyHeaderStyle);

  calculations.forEach(row => {
    wsCalc.addRow({
      sales_tax_calc_id: row.sales_tax_calc_id,
      order_number: row.order_number ?? row.order_id,
      issue_date: formatDateBR(row.issue_date),
      customer_name: row.customer_name,
      net_total: toNumber(row.net_total),
      tax_burden_total: toNumber(row.tax_burden_total),
      gross_profit_total: toNumber(row.gross_profit_total),
      margin_percent: toNumber(row.margin_percent)
    });
  });

  wsCalc.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      row.eachCell(applyBodyBorder);
    }
  });

  ['E', 'F', 'G'].forEach(col => {
    wsCalc.getColumn(col).numFmt = '"R$" #,##0.00';
  });
  wsCalc.getColumn('H').numFmt = '0.0000';

  /* ====================================================================
     ITENS
  ==================================================================== */
  const wsItems = workbook.addWorksheet('Itens');

  wsItems.columns = [
    { header: 'SKU', key: 'sku', width: 14 },
    { header: 'Descrição', key: 'description', width: 40 },
    { header: 'Qtd', key: 'quantity', width: 10 },
    { header: 'Un', key: 'unit', width: 8 },
    { header: 'Unitário', key: 'unit_price', width: 14 },
    { header: 'Líquido', key: 'net_value', width: 14 },
    { header: 'Custo', key: 'cost_total', width: 14 },
    { header: 'ICMS', key: 'icms_value', width: 12 },
    { header: 'PIS', key: 'pis_value', width: 12 },
    { header: 'COFINS', key: 'cofins_value', width: 12 },
    { header: 'IPI', key: 'ipi_value', width: 12 },
    { header: 'FCP', key: 'fcp_value', width: 12 },
    { header: 'Carga Estimada', key: 'estimated_tax_burden', width: 16 },
    { header: 'Lucro Bruto', key: 'gross_profit_value', width: 14 },
    { header: 'Margem (%)', key: 'gross_margin_percent', width: 14 }
  ];

  wsItems.getRow(1).eachCell(applyHeaderStyle);

  items.forEach(row => {
    wsItems.addRow({
      sku: row.sku,
      description: row.description,
      quantity: toNumber(row.quantity),
      unit: row.unit,
      unit_price: toNumber(row.unit_price),
      net_value: toNumber(row.net_value),
      cost_total: toNumber(row.cost_total),
      icms_value: toNumber(row.icms_value),
      pis_value: toNumber(row.pis_value),
      cofins_value: toNumber(row.cofins_value),
      ipi_value: toNumber(row.ipi_value),
      fcp_value: toNumber(row.fcp_value),
      estimated_tax_burden: toNumber(row.estimated_tax_burden),
      gross_profit_value: toNumber(row.gross_profit_value),
      gross_margin_percent: toNumber(row.gross_margin_percent)
    });
  });

  wsItems.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      row.eachCell(applyBodyBorder);
    }
  });

  ['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'].forEach(col => {
    wsItems.getColumn(col).numFmt = '"R$" #,##0.00';
  });
  wsItems.getColumn('C').numFmt = '0.000';
  wsItems.getColumn('O').numFmt = '0.0000';

  /* ====================================================================
     RECONCILIAÇÃO
  ==================================================================== */
  const wsRecon = workbook.addWorksheet('Reconsolidacao');

  wsRecon.columns = [
    { header: 'ID', key: 'reconciliation_id', width: 10 },
    { header: 'Order', key: 'order_id', width: 12 },
    { header: 'Item', key: 'order_item_id', width: 12 },
    { header: 'SKU', key: 'sku', width: 14 },
    { header: 'Divergência', key: 'divergence_type', width: 24 },
    { header: 'Esperado', key: 'expected_value', width: 14 },
    { header: 'Atual', key: 'actual_value', width: 14 },
    { header: 'Diferença', key: 'difference_value', width: 14 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Detalhes', key: 'details', width: 40 }
  ];

  wsRecon.getRow(1).eachCell(applyHeaderStyle);

  reconciliation.forEach(row => {
    wsRecon.addRow({
      reconciliation_id: row.reconciliation_id,
      order_id: row.order_id,
      order_item_id: row.order_item_id,
      sku: row.sku,
      divergence_type: row.divergence_type,
      expected_value: row.expected_value == null ? null : toNumber(row.expected_value),
      actual_value: row.actual_value == null ? null : toNumber(row.actual_value),
      difference_value: row.difference_value == null ? null : toNumber(row.difference_value),
      status: row.status,
      details: row.details
    });
  });

  wsRecon.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      row.eachCell(applyBodyBorder);
    }
  });

  ['F', 'G', 'H'].forEach(col => {
    wsRecon.getColumn(col).numFmt = '"R$" #,##0.00';
  });

  await workbook.xlsx.writeFile(outputFilePath);

  return outputFilePath;
}

export default generateSalesTaxCalculationExcel;