// ╔══════════════════════════════════════════════════════════════════════╗
// ║ generationSellersExcel.js                                           ║
// ║ XLSX - Relatório de Vendedores                                       ║
// ║ CONSART ERP | ExcelJS | ESM                                          ║
// ║ - Cabeçalho CONSART + KPIs + tabela com filtros em todas as colunas  ║
// ║   (KPIs com SUBTOTAL: acompanham os filtros aplicados)              ║
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
};

const FONT = 'Calibri';

const COLUMNS = [
    { header: 'ID', width: 8 },
    { header: 'Nome', width: 34 },
    { header: 'Apelido', width: 16 },
    { header: 'Documento', width: 18 },
    { header: 'E-mail', width: 34 },
    { header: 'Telefone', width: 16 },
    { header: 'Celular', width: 16 },
    { header: 'Tipo comissão', width: 16 },
    { header: 'Comissão', width: 13 },
    { header: 'Status', width: 11 },
    { header: 'Observações', width: 36 },
];

const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

const isFixed = (s) => String(s.commission_type || 'PERCENT').toUpperCase() === 'FIXED';

const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const thin = (argb = ARGB.border) => ({ style: 'thin', color: { argb } });

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

export async function buildSellersWorkbook({ filters = {}, sellers = [] } = {}) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CONSART ERP';
    workbook.created = new Date();
    workbook.title = 'Relatório de Vendedores';

    const sheet = workbook.addWorksheet('Vendedores', {
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
        headerFooter: { oddFooter: '&L&8CONSART ERP · Relatório de Vendedores&R&8Página &P de &N' },
    });

    const lastCol = COLUMNS.length;
    const last = colLetter(lastCol);
    COLUMNS.forEach((c, i) => { sheet.getColumn(i + 1).width = c.width; });

    /* ---------------- Cabeçalho CONSART ---------------- */

    sheet.getRow(1).height = 34;
    sheet.getRow(2).height = 18;
    sheet.getRow(3).height = 20;
    sheet.getRow(4).height = 4;

    for (let r = 1; r <= 4; r += 1) {
        for (let c = 1; c <= lastCol; c += 1) {
            sheet.getCell(r, c).fill = fill(r === 4 ? ARGB.teal : ARGB.navy);
        }
    }

    sheet.mergeCells(`B1:${last}1`);
    sheet.mergeCells(`B2:${last}2`);
    sheet.mergeCells(`B3:${last}3`);

    const status = filters.active === true ? 'Apenas ativos' : filters.active === false ? 'Apenas inativos' : 'Todos';
    const search = String(filters.q || '').trim() || 'Todos';
    const generatedAt = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    Object.assign(sheet.getCell('B1'), {
        value: 'RELATÓRIO DE VENDEDORES',
        font: { name: FONT, size: 16, bold: true, color: { argb: ARGB.white } },
        alignment: { vertical: 'middle', indent: 1 },
    });

    Object.assign(sheet.getCell('B2'), {
        value: 'CONSART ERP  ·  Vendedores cadastrados e regras de comissão',
        font: { name: FONT, size: 10, color: { argb: 'FFC7D4E6' } },
        alignment: { vertical: 'middle', indent: 1 },
    });

    Object.assign(sheet.getCell('B3'), {
        value: `Busca: ${search}     |     Status: ${status}     |     Gerado em: ${generatedAt}`,
        font: { name: FONT, size: 9, color: { argb: ARGB.white } },
        alignment: { vertical: 'middle', indent: 1 },
    });

    try {
        if (fs.existsSync(LOGO_PATH)) {
            const logoId = workbook.addImage({ buffer: fs.readFileSync(LOGO_PATH), extension: 'png' });
            sheet.addImage(logoId, { tl: { col: 0.1, row: 0.1 }, ext: { width: 52, height: 52 }, editAs: 'oneCell' });
        }
    } catch {
        // sem logo
    }

    /* ---------------- KPIs (linhas 6–7) ---------------- */

    const headerRow = 9;
    const firstData = headerRow + 1;
    const lastData = headerRow + Math.max(sellers.length, 1);
    const rng = (header) => {
        const c = colLetter(COLUMNS.findIndex((x) => x.header === header) + 1);
        return `${c}${firstData}:${c}${lastData}`;
    };

    const activeCount = sellers.filter((s) => s.active !== false).length;
    const fixedCount = sellers.filter(isFixed).length;

    // Contagens que respeitam o filtro: SUMPRODUCT(SUBTOTAL(103, OFFSET(...)) * (cond))
    const visibleIf = (header, cond) => {
        const r = rng(header);
        const c0 = r.split(':')[0];
        return `SUMPRODUCT(SUBTOTAL(103,OFFSET(${c0},ROW(${r})-ROW(${c0}),0))*(${r}=${cond}))`;
    };

    const kpis = [
        { label: 'VENDEDORES (FILTRADOS)', cols: 'A6:C6', vcols: 'A7:C7', formula: `SUBTOTAL(103,${rng('Nome')})`, result: sellers.length },
        { label: 'ATIVOS', cols: 'D6:D6', vcols: 'D7:D7', formula: visibleIf('Status', '"Ativo"'), result: activeCount },
        { label: 'INATIVOS', cols: 'E6:E6', vcols: 'E7:E7', formula: visibleIf('Status', '"Inativo"'), result: sellers.length - activeCount },
        { label: 'PERCENTUAL', cols: 'F6:G6', vcols: 'F7:G7', formula: visibleIf('Tipo comissão', '"Percentual (%)"'), result: sellers.length - fixedCount },
        { label: 'VALOR FIXO', cols: 'H6:I6', vcols: 'H7:I7', formula: visibleIf('Tipo comissão', '"Valor fixo (R$)"'), result: fixedCount },
    ];

    sheet.getRow(5).height = 8;
    sheet.getRow(6).height = 16;
    sheet.getRow(7).height = 26;
    sheet.getRow(8).height = 8;

    kpis.forEach((k) => {
        if (k.cols.split(':')[0] !== k.cols.split(':')[1]) {
            sheet.mergeCells(k.cols);
            sheet.mergeCells(k.vcols);
        }

        Object.assign(sheet.getCell(k.cols.split(':')[0]), {
            value: k.label,
            font: { name: FONT, size: 8, bold: true, color: { argb: ARGB.muted } },
            alignment: { vertical: 'bottom', indent: 1 },
        });

        Object.assign(sheet.getCell(k.vcols.split(':')[0]), {
            value: { formula: k.formula, result: k.result },
            numFmt: '#,##0',
            font: { name: FONT, size: 14, bold: true, color: { argb: ARGB.navy } },
            alignment: { vertical: 'middle', horizontal: 'left', indent: 1 },
        });

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

    const rows = sellers.map((s) => [
        Number.isFinite(Number(s.id)) ? Number(s.id) : s.id ?? null,
        s.name || null,
        s.nickname || null,
        s.document || null,
        s.email || null,
        s.phone || null,
        s.mobile || null,
        isFixed(s) ? 'Valor fixo (R$)' : 'Percentual (%)',
        num(s.commission_value),
        s.active !== false ? 'Ativo' : 'Inativo',
        s.observations || null,
    ]);

    if (!rows.length) {
        rows.push([null, 'Nenhum vendedor encontrado com os filtros atuais.', null, null, null, null, null, null, null, null, null]);
    }

    sheet.addTable({
        name: 'TabelaVendedores',
        ref: `A${headerRow}`,
        headerRow: true,
        totalsRow: false,
        style: { theme: 'TableStyleMedium2', showRowStripes: true },
        columns: COLUMNS.map((c) => ({ name: c.header, filterButton: true })),
        rows,
    });

    for (let r = firstData; r < firstData + rows.length; r += 1) {
        const row = sheet.getRow(r);
        const seller = sellers[r - firstData];
        row.height = 18;
        row.font = { name: FONT, size: 10, color: { argb: ARGB.text } };

        [1, 4, 6, 7, 8].forEach((c) => { row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' }; });

        const commission = row.getCell(9);
        commission.numFmt = seller && isFixed(seller) ? '"R$" #,##0.00' : '#,##0.00" %"';
        commission.alignment = { horizontal: 'right', vertical: 'middle' };
        commission.font = { name: FONT, size: 10, bold: true, color: { argb: ARGB.navy } };

        const st = row.getCell(10);
        st.alignment = { horizontal: 'center', vertical: 'middle' };
        if (seller) {
            const on = seller.active !== false;
            st.font = { name: FONT, size: 10, bold: true, color: { argb: on ? 'FF166534' : 'FF991B1B' } };
            st.fill = fill(on ? 'FFDCFCE7' : 'FFFEE2E2');
        }

        row.getCell(11).alignment = { vertical: 'middle', wrapText: false };
    }

    const hdr = sheet.getRow(headerRow);
    hdr.height = 22;
    hdr.eachCell((cell) => {
        cell.fill = fill(ARGB.blue);
        cell.font = { name: FONT, bold: true, color: { argb: ARGB.white }, size: 10 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    sheet.views = [{ state: 'frozen', ySplit: headerRow, showGridLines: false, topLeftCell: `A${firstData}` }];
    sheet.pageSetup.printTitlesRow = `${headerRow}:${headerRow}`;

    return workbook;
}

export default buildSellersWorkbook;
