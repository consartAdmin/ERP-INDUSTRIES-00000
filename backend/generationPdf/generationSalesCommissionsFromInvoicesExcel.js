// ╔══════════════════════════════════════════════════════════════════════╗
// ║ generationSalesCommissionsFromInvoicesExcel.js                      ║
// ║ XLSX - Relatório de Comissões por NF-e                               ║
// ║ CONSART ERP | ExcelJS | ESM                                          ║
// ║ - Aba "Comissões": cabeçalho CONSART + KPIs + tabela com filtros     ║
// ║   (totais com SUBTOTAL, acompanham os filtros aplicados)            ║
// ║ - Aba "Resumo": por vendedor, por tabela de preço e por dia          ║
// ╚══════════════════════════════════════════════════════════════════════╝

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import ExcelJS from 'exceljs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LOGO_PATH = path.resolve(__dirname, '../public/imagens/brasaoConsart.png');

const ARGB = {
    navy: 'FF0F2747',
    blue: 'FF174A7E',
    teal: 'FF14B8A6',
    text: 'FF1E293B',
    muted: 'FF64748B',
    border: 'FFDBE3EE',
    soft: 'FFF4F7FB',
    white: 'FFFFFFFF',
    totals: 'FFE6EEF8',
};

const FMT = {
    money: '"R$" #,##0.00;[Red]-"R$" #,##0.00',
    qty: '#,##0.000',
    pct: '#,##0.00',
    pctRatio: '0.00%',
    int: '#,##0',
    date: 'dd/mm/yyyy',
};

const COMMISSION_TYPE_LABELS = { PERCENT: 'PERCENTUAL', FIXED: 'FIXO' };
const commissionTypeLabel = (t) => COMMISSION_TYPE_LABELS[String(t || '').toUpperCase()] || t || null;

/* ======================================================================
   Helpers
====================================================================== */

const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

const numOrNull = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

function isoDay(value) {
    if (!value) return '';
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value).slice(0, 10);
}

// Data "pura" em UTC para o Excel não deslocar o dia pelo fuso
function excelDate(value) {
    const s = isoDay(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const [y, m, d] = s.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
}

function dateBR(value) {
    const s = isoDay(value);
    const [y, m, d] = s.split('-');
    return y && m && d ? `${d}/${m}/${y}` : '-';
}

function periodLabel(filters = {}) {
    const { dateStart, dateEnd } = filters;
    if (!dateStart && !dateEnd) return 'Todos os períodos';
    if (dateStart && dateEnd) return `${dateBR(dateStart)} a ${dateBR(dateEnd)}`;
    if (dateStart) return `A partir de ${dateBR(dateStart)}`;
    return `Até ${dateBR(dateEnd)}`;
}

function orderLabel(row) {
    if (row.order_id) return String(row.order_id);
    if (row.budget_id) return `Orç. ${row.budget_id}`;
    return null;
}

function colLetter(n) {
    let s = '';
    let x = n;
    while (x > 0) {
        const m = (x - 1) % 26;
        s = String.fromCharCode(65 + m) + s;
        x = Math.floor((x - 1) / 26);
    }
    return s;
}

function groupSum(rows, keyFn) {
    const map = new Map();

    for (const r of rows) {
        const key = keyFn(r);
        const cur = map.get(key) || { label: key, revenue: 0, commission: 0, items: 0, invoices: new Set() };
        cur.revenue += num(r.item_total);
        cur.commission += num(r.item_commission);
        cur.items += 1;
        if (r.invoice_id) cur.invoices.add(r.invoice_id);
        map.set(key, cur);
    }

    return [...map.values()].map((g) => ({ ...g, invoices: g.invoices.size }));
}

const thin = (argb = ARGB.border) => ({ style: 'thin', color: { argb } });

function fill(argb) {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

/* ======================================================================
   Cabeçalho CONSART (linhas 1–3)
====================================================================== */

function addBrandHeader(workbook, sheet, { lastCol, subtitle, ctx, logoId }) {
    const last = colLetter(lastCol);

    sheet.getRow(1).height = 34;
    sheet.getRow(2).height = 18;
    sheet.getRow(3).height = 20;

    for (let r = 1; r <= 3; r += 1) {
        for (let c = 1; c <= lastCol; c += 1) {
            sheet.getCell(r, c).fill = fill(ARGB.navy);
        }
    }

    // faixa teal abaixo do cabeçalho
    sheet.getRow(4).height = 4;
    for (let c = 1; c <= lastCol; c += 1) sheet.getCell(4, c).fill = fill(ARGB.teal);

    sheet.mergeCells(`B1:${last}1`);
    sheet.mergeCells(`B2:${last}2`);
    sheet.mergeCells(`B3:${last}3`);

    const title = sheet.getCell('B1');
    title.value = 'RELATÓRIO DE COMISSÕES POR NF-e';
    title.font = { name: 'Calibri', size: 16, bold: true, color: { argb: ARGB.white } };
    title.alignment = { vertical: 'middle', indent: 1 };

    const sub = sheet.getCell('B2');
    sub.value = `CONSART ERP  ·  ${subtitle}`;
    sub.font = { name: 'Calibri', size: 10, color: { argb: 'FFC7D4E6' } };
    sub.alignment = { vertical: 'middle', indent: 1 };

    const info = sheet.getCell('B3');
    info.value = `Período: ${ctx.period}     |     Vendedor: ${ctx.seller}     |     Tabela de preço: ${ctx.priceTable}     |     Gerado em: ${ctx.generatedAt}`;
    info.font = { name: 'Calibri', size: 9, color: { argb: ARGB.white } };
    info.alignment = { vertical: 'middle', indent: 1 };

    if (logoId != null) {
        sheet.addImage(logoId, { tl: { col: 0.15, row: 0.1 }, ext: { width: 54, height: 54 }, editAs: 'oneCell' });
    }
}

/* ======================================================================
   Aba Comissões
====================================================================== */

const DETAIL_COLUMNS = [
    { header: 'Data', width: 12, fmt: FMT.date, total: 'none' },
    { header: 'NF-e', width: 10, total: 'none' },
    { header: 'Pedido', width: 12, total: 'none' },
    { header: 'Cliente', width: 42, total: 'custom-count' },
    { header: 'Vendedor', width: 18, total: 'none' },
    { header: 'SKU', width: 12, total: 'none' },
    { header: 'Produto', width: 12, total: 'none' },
    { header: 'Tabela', width: 14, total: 'none' },
    { header: 'Qtd', width: 11, fmt: FMT.qty, total: 'sum' },
    { header: 'Total Item', width: 15, fmt: FMT.money, total: 'sum' },
    { header: 'Tipo', width: 13, total: 'none' },
    { header: '%', width: 9, fmt: FMT.pct, total: 'none' },
    { header: 'Fixo', width: 12, fmt: FMT.money, total: 'none' },
    { header: 'Comissão', width: 15, fmt: FMT.money, total: 'sum' },
];

function buildDetailSheet(workbook, { rows, diagnostics, ctx, logoId }) {
    const sheet = workbook.addWorksheet('Comissões', {
        properties: { tabColor: { argb: ARGB.blue } },
        views: [{ showGridLines: false }],
        pageSetup: {
            orientation: 'landscape',
            paperSize: 9,
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
        },
        headerFooter: {
            oddFooter: '&L&8CONSART ERP · Relatório de Comissões por NF-e&R&8Página &P de &N',
        },
    });

    const lastCol = DETAIL_COLUMNS.length;
    DETAIL_COLUMNS.forEach((c, i) => { sheet.getColumn(i + 1).width = c.width; });

    addBrandHeader(workbook, sheet, {
        lastCol,
        subtitle: 'Comissões geradas a partir das NF-e autorizadas',
        ctx,
        logoId,
    });

    /* ---------------- KPIs (linhas 6–7) ---------------- */

    const headerRow = 9;
    const firstData = headerRow + 1;
    const lastData = headerRow + Math.max(rows.length, 1);
    const colOf = (name) => colLetter(DETAIL_COLUMNS.findIndex((c) => c.header === name) + 1);

    const rng = (name) => `${colOf(name)}${firstData}:${colOf(name)}${lastData}`;

    const totalRevenue = rows.reduce((s, r) => s + num(r.item_total), 0);
    const totalCommission = rows.reduce((s, r) => s + num(r.item_commission), 0);

    const kpis = [
        { label: 'ITENS (FILTRADOS)', cols: 'A6:C6', vcols: 'A7:C7', formula: `SUBTOTAL(103,${rng('Cliente')})`, result: rows.length, fmt: FMT.int },
        { label: 'TOTAL FATURADO', cols: 'D6:E6', vcols: 'D7:E7', formula: `SUBTOTAL(109,${rng('Total Item')})`, result: totalRevenue, fmt: FMT.money },
        { label: 'TOTAL COMISSÃO', cols: 'F6:H6', vcols: 'F7:H7', formula: `SUBTOTAL(109,${rng('Comissão')})`, result: totalCommission, fmt: FMT.money },
        { label: '% MÉDIO', cols: 'I6:J6', vcols: 'I7:J7', formula: `IFERROR(F7/D7,0)`, result: totalRevenue ? totalCommission / totalRevenue : 0, fmt: FMT.pctRatio },
        { label: 'SEM REGRA', cols: 'K6:L6', vcols: 'K7:L7', value: num(diagnostics.sem_commission_id), fmt: FMT.int },
        { label: 'NF-e', cols: 'M6:N6', vcols: 'M7:N7', value: new Set(rows.map((r) => r.invoice_id).filter(Boolean)).size, fmt: FMT.int },
    ];

    sheet.getRow(5).height = 8;
    sheet.getRow(6).height = 16;
    sheet.getRow(7).height = 26;
    sheet.getRow(8).height = 8;

    kpis.forEach((k) => {
        sheet.mergeCells(k.cols);
        sheet.mergeCells(k.vcols);

        const l = sheet.getCell(k.cols.split(':')[0]);
        l.value = k.label;
        l.font = { name: 'Calibri', size: 8, bold: true, color: { argb: ARGB.muted } };
        l.alignment = { vertical: 'bottom', indent: 1 };

        const v = sheet.getCell(k.vcols.split(':')[0]);
        v.value = k.formula ? { formula: k.formula, result: k.result } : k.value;
        v.numFmt = k.fmt;
        v.font = { name: 'Calibri', size: 14, bold: true, color: { argb: ARGB.navy } };
        v.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

        const [c1, c2] = k.cols.split(':').map((a) => a.replace(/\d+/, ''));
        const from = sheet.getColumn(c1).number;
        const to = sheet.getColumn(c2).number;

        for (let c = from; c <= to; c += 1) {
            for (const r of [6, 7]) {
                const cell = sheet.getCell(r, c);
                cell.fill = fill(ARGB.soft);
                cell.border = {
                    top: r === 6 ? thin() : undefined,
                    bottom: r === 7 ? thin() : undefined,
                    left: c === from ? { style: 'medium', color: { argb: ARGB.teal } } : undefined,
                    right: c === to ? thin() : undefined,
                };
            }
        }
    });

    /* ---------------- Tabela com filtros ---------------- */

    const tableRows = rows.map((r) => [
        excelDate(r.issue_date),
        numOrNull(r.invoice_id) ?? r.invoice_id ?? null,
        orderLabel(r),
        r.customer_name || null,
        r.seller_name || r.seller_id || null,
        r.sku || null,
        r.product_code || r.product_id || null,
        r.price_table_name || r.price_id || null,
        numOrNull(r.quantity),
        numOrNull(r.item_total),
        commissionTypeLabel(r.commission_type),
        numOrNull(r.percent_value),
        numOrNull(r.fixed_value),
        numOrNull(r.item_commission),
    ]);

    if (!tableRows.length) {
        tableRows.push([null, null, null, 'Nenhuma comissão encontrada para os filtros selecionados.', null, null, null, null, null, null, null, null, null, null]);
    }

    sheet.addTable({
        name: 'TabelaComissoes',
        ref: `A${headerRow}`,
        headerRow: true,
        totalsRow: true,
        style: { theme: 'TableStyleMedium2', showRowStripes: true },
        columns: DETAIL_COLUMNS.map((c) => {
            if (c.total === 'sum') return { name: c.header, filterButton: true, totalsRowFunction: 'sum' };
            if (c.total === 'custom-count') return { name: c.header, filterButton: true, totalsRowFunction: 'count' };
            if (c.header === 'Data') return { name: c.header, filterButton: true, totalsRowLabel: 'TOTAL' };
            return { name: c.header, filterButton: true, totalsRowFunction: 'none' };
        }),
        rows: tableRows,
    });

    const totalsRowNum = headerRow + tableRows.length + 1;

    // formatos por coluna (dados + total)
    DETAIL_COLUMNS.forEach((c, i) => {
        if (!c.fmt) return;
        for (let r = firstData; r <= totalsRowNum; r += 1) {
            sheet.getCell(r, i + 1).numFmt = c.fmt;
        }
    });

    // alinhamentos
    for (let r = firstData; r <= totalsRowNum; r += 1) {
        const row = sheet.getRow(r);
        row.height = 17;
        row.font = { name: 'Calibri', size: 10, color: { argb: ARGB.text } };
        [1, 2, 3, 6, 7, 11].forEach((c) => { row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' }; });
        [9, 10, 12, 13, 14].forEach((c) => { row.getCell(c).alignment = { horizontal: 'right', vertical: 'middle' }; });
        row.getCell(14).font = { name: 'Calibri', size: 10, bold: true, color: { argb: ARGB.navy } };
    }

    const hdr = sheet.getRow(headerRow);
    hdr.height = 22;
    hdr.eachCell((cell) => {
        cell.fill = fill(ARGB.blue);
        cell.font = { name: 'Calibri', bold: true, color: { argb: ARGB.white }, size: 10 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    const tot = sheet.getRow(totalsRowNum);
    tot.height = 20;
    tot.eachCell({ includeEmpty: true }, (cell, c) => {
        if (c > lastCol) return;
        cell.fill = fill(ARGB.totals);
        cell.font = { name: 'Calibri', bold: true, color: { argb: ARGB.navy }, size: 10 };
        cell.border = { top: { style: 'medium', color: { argb: ARGB.blue } } };
    });

    sheet.views = [{ state: 'frozen', ySplit: headerRow, xSplit: 0, showGridLines: false, topLeftCell: `A${firstData}` }];
    sheet.pageSetup.printTitlesRow = `${headerRow}:${headerRow}`;

    return sheet;
}

/* ======================================================================
   Aba Resumo
====================================================================== */

function addSummaryTable(sheet, { startRow, title, name, labelHeader, data, totals }) {
    const titleCell = sheet.getCell(startRow, 1);
    titleCell.value = title;
    titleCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: ARGB.navy } };
    sheet.getRow(startRow).height = 20;

    for (let c = 1; c <= 6; c += 1) {
        sheet.getCell(startRow, c).border = { bottom: { style: 'medium', color: { argb: ARGB.teal } } };
    }

    const headerRow = startRow + 1;

    const rows = data.length
        ? data.map((d) => [d.label, d.invoices, d.items, d.revenue, d.revenue > 0 ? d.commission / d.revenue : 0, d.commission])
        : [['Sem dados', 0, 0, 0, 0, 0]];

    sheet.addTable({
        name,
        ref: `A${headerRow}`,
        headerRow: true,
        totalsRow: totals,
        style: { theme: 'TableStyleMedium2', showRowStripes: true },
        columns: [
            { name: labelHeader, filterButton: true, totalsRowLabel: 'TOTAL' },
            { name: 'NF-e', filterButton: true, totalsRowFunction: 'sum' },
            { name: 'Itens', filterButton: true, totalsRowFunction: 'sum' },
            { name: 'Faturado', filterButton: true, totalsRowFunction: 'sum' },
            { name: '% médio', filterButton: true, totalsRowFunction: 'none' },
            { name: 'Comissão', filterButton: true, totalsRowFunction: 'sum' },
        ],
        rows,
    });

    const last = headerRow + rows.length + (totals ? 1 : 0);

    for (let r = headerRow + 1; r <= last; r += 1) {
        const row = sheet.getRow(r);
        row.height = 17;
        row.getCell(2).numFmt = FMT.int;
        row.getCell(3).numFmt = FMT.int;
        row.getCell(4).numFmt = FMT.money;
        row.getCell(5).numFmt = FMT.pctRatio;
        row.getCell(6).numFmt = FMT.money;
        row.getCell(6).font = { name: 'Calibri', bold: true, color: { argb: ARGB.navy } };
    }

    if (totals) {
        const tr = sheet.getRow(last);
        // % médio do total = comissão / faturado
        tr.getCell(5).value = { formula: `IFERROR(F${last}/D${last},0)` };
        for (let c = 1; c <= 6; c += 1) {
            const cell = tr.getCell(c);
            cell.fill = fill(ARGB.totals);
            cell.font = { name: 'Calibri', bold: true, color: { argb: ARGB.navy } };
        }
    }

    const hdr = sheet.getRow(headerRow);
    hdr.height = 20;
    for (let c = 1; c <= 6; c += 1) {
        const cell = hdr.getCell(c);
        cell.fill = fill(ARGB.blue);
        cell.font = { name: 'Calibri', bold: true, color: { argb: ARGB.white } };
        cell.alignment = { horizontal: c === 1 ? 'left' : 'center', vertical: 'middle' };
    }

    return last + 3;
}

function buildSummarySheet(workbook, { rows, ctx, logoId }) {
    const sheet = workbook.addWorksheet('Resumo', {
        properties: { tabColor: { argb: ARGB.teal } },
        views: [{ showGridLines: false }],
        pageSetup: { orientation: 'portrait', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });

    [30, 12, 12, 18, 12, 18].forEach((w, i) => { sheet.getColumn(i + 1).width = w; });

    addBrandHeader(workbook, sheet, {
        lastCol: 6,
        subtitle: 'Resumo das comissões',
        ctx: { ...ctx, generatedAt: ctx.generatedAt },
        logoId,
    });

    // o texto de filtros é longo para 6 colunas: quebra em duas linhas
    sheet.getRow(3).height = 30;
    sheet.getCell('B3').alignment = { vertical: 'middle', wrapText: true, indent: 1 };

    const bySeller = groupSum(rows, (r) => String(r.seller_name || r.seller_id || 'Sem vendedor'))
        .sort((a, b) => b.commission - a.commission);

    const byTable = groupSum(rows, (r) => String(r.price_table_name || r.price_id || 'Sem tabela'))
        .sort((a, b) => b.commission - a.commission);

    const byDay = groupSum(rows, (r) => isoDay(r.issue_date) || 'Sem data')
        .sort((a, b) => a.label.localeCompare(b.label))
        .map((d) => ({ ...d, label: d.label === 'Sem data' ? d.label : dateBR(d.label) }));

    let row = 6;
    row = addSummaryTable(sheet, { startRow: row, title: 'Comissão por vendedor', name: 'ResumoVendedor', labelHeader: 'Vendedor', data: bySeller, totals: true });
    row = addSummaryTable(sheet, { startRow: row, title: 'Comissão por tabela de preço', name: 'ResumoTabela', labelHeader: 'Tabela de preço', data: byTable, totals: true });
    addSummaryTable(sheet, { startRow: row, title: 'Comissão por dia (emissão da NF-e)', name: 'ResumoDia', labelHeader: 'Data', data: byDay, totals: true });

    return sheet;
}

/* ======================================================================
   Main
====================================================================== */

export async function buildSalesCommissionsFromInvoicesWorkbook({
    filters = {},
    diagnostics = {},
    rows = [],
} = {}) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CONSART ERP';
    workbook.created = new Date();
    workbook.title = 'Relatório de Comissões por NF-e';

    let logoId = null;
    try {
        if (fs.existsSync(LOGO_PATH)) {
            logoId = workbook.addImage({ buffer: fs.readFileSync(LOGO_PATH), extension: 'png' });
        }
    } catch {
        logoId = null;
    }

    const priceTable = filters.priceId
        ? String(rows.find((r) => String(r.price_id) === String(filters.priceId))?.price_table_name || `#${filters.priceId}`)
        : 'Todas';

    const ctx = {
        period: periodLabel(filters),
        seller: String(filters.salesperson || '').trim() || 'Todos',
        priceTable,
        generatedAt: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    };

    buildDetailSheet(workbook, { rows, diagnostics, ctx, logoId });
    buildSummarySheet(workbook, { rows, ctx, logoId });

    return workbook;
}

export default buildSalesCommissionsFromInvoicesWorkbook;
