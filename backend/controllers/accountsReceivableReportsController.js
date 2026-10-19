'use strict';

import ExcelJS from 'exceljs';
import { getSummary, listSales, listAllSales } from '../repositories/accountsReceivableReports/accountsReceivableReports.index.js';

function filters(query = {}) {
  return {
    fromDate: query.fromDate || null,
    toDate: query.toDate || null,
    customerId: query.customerId || null,
    search: String(query.search || '').trim(),
    receivableStatus: query.receivableStatus || null,
    onlyDivergences: ['1', 'true', 'yes'].includes(String(query.onlyDivergences).toLowerCase()),
    page: query.page,
    pageSize: query.pageSize,
    orderBy: query.orderBy,
    orderDirection: query.orderDirection,
  };
}

function fail(res, error, context) {
  console.error(`[ACCOUNTS-RECEIVABLE-REPORTS/${context}]`, error);
  return res.status(500).json({ ok: false, message: 'Erro ao gerar relatório de vendas e recebimentos.', error: error?.message || String(error) });
}

export async function summary(req, res) {
  try { return res.json({ ok: true, data: await getSummary(filters(req.query)) }); }
  catch (error) { return fail(res, error, 'SUMMARY'); }
}

export async function sales(req, res) {
  try {
    const result = await listSales(filters(req.query));
    return res.json({ ok: true, items: result.data, total: result.total, page: result.page, pageSize: result.pageSize, totalPages: result.pages });
  } catch (error) { return fail(res, error, 'SALES'); }
}

export async function divergences(req, res) {
  try {
    const result = await listSales({ ...filters(req.query), onlyDivergences: true });
    return res.json({ ok: true, items: result.data, total: result.total, page: result.page, pageSize: result.pageSize, totalPages: result.pages });
  } catch (error) { return fail(res, error, 'DIVERGENCES'); }
}

export async function exportExcel(req, res) {
  try {
    const rows = await listAllSales(filters(req.query));
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Vendas x Recebimentos');
    sheet.columns = [
      { header: 'Pedido', key: 'order_number', width: 12 }, { header: 'Data', key: 'issue_date', width: 13 },
      { header: 'Cliente', key: 'customer_name', width: 34 }, { header: 'NF-e', key: 'nfe_number', width: 14 },
      { header: 'Venda', key: 'sale_total', width: 15 }, { header: 'Conta', key: 'invoice_number', width: 18 },
      { header: 'Vencimento', key: 'due_date', width: 13 }, { header: 'A receber', key: 'receivable_value', width: 15 },
      { header: 'Recebido', key: 'received_value', width: 15 }, { header: 'Saldo', key: 'balance', width: 15 },
      { header: 'Diferença', key: 'difference', width: 15 }, { header: 'Conciliação', key: 'reconciliation_status', width: 18 },
    ];
    rows.forEach((row) => sheet.addRow(row));
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF174A7E' } };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    ['E', 'H', 'I', 'J', 'K'].forEach((column) => { sheet.getColumn(column).numFmt = 'R$ #,##0.00'; });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="vendas-x-recebimentos.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) { return fail(res, error, 'EXPORT'); }
}
