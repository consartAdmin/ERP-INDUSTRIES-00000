// ╔══════════════════════════════════════════════════════════════════════╗
// ║ taxAssessment.export.js — Apuração: memória de cálculo (Excel / PDF)║
// ║ CONSART ERP                                                        ║
// ║                                                                      ║
// ║ ✅ Excel: memória de cálculo, resumo por imposto, créditos          ║
// ║ ✅ PDF: memória de cálculo em A4                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';


const MONEY_FORMAT = '"R$" #,##0.00;[Red]-"R$" #,##0.00';

const COLORS = Object.freeze({
    title: '1E3A8A',
    section: 'DBEAFE',
    sectionText: '1E3A8A',
    total: 'F1F5F9',
    muted: '64748B',
    border: 'CBD5E1',
});

function num(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function brl(value) {
    return num(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function dateBR(value) {
    return String(value || '').slice(0, 10).split('-').reverse().join('/');
}

function periodText(data) {
    return `${dateBR(data.filters?.startDate)} até ${dateBR(data.filters?.endDate)}`;
}

function generatedAt() {
    return new Date().toLocaleString('pt-BR');
}

export function exportFileName(data, extension) {
    const start = String(data.filters?.startDate || '').slice(0, 10);
    const end = String(data.filters?.endDate || '').slice(0, 10);
    return `memoria_calculo_apuracao_${start}_${end}.${extension}`;
}


// ======================================================================
// EXCEL
// ======================================================================

export async function buildAssessmentXlsx(data) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CONSART ERP';
    workbook.created = new Date();

    addMemorySheet(workbook, data);
    addSummarySheet(workbook, data);
    addOriginsSheet(workbook, data);

    return Buffer.from(await workbook.xlsx.writeBuffer());
}

function addHeader(sheet, data, title, lastColumn) {
    sheet.mergeCells(`A1:${lastColumn}1`);
    sheet.getCell('A1').value = title;
    sheet.getCell('A1').font = { bold: true, size: 14, color: { argb: COLORS.title } };

    sheet.mergeCells(`A2:${lastColumn}2`);
    sheet.getCell('A2').value = `Período: ${periodText(data)} · Regime: ${data.regime?.summary || data.regime?.label || 'sem regime cadastrado'}`;
    sheet.getCell('A2').font = { size: 10, color: { argb: COLORS.muted } };

    sheet.mergeCells(`A3:${lastColumn}3`);
    sheet.getCell('A3').value = `Gerado em ${generatedAt()} · valores estimados, conferir com a contabilidade`;
    sheet.getCell('A3').font = { size: 9, italic: true, color: { argb: COLORS.muted } };
}

function styleHeaderRow(row) {
    row.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.title } };
        cell.alignment = { vertical: 'middle' };
    });
}

function addMemorySheet(workbook, data) {
    const sheet = workbook.addWorksheet('Memória de cálculo', {
        views: [{ state: 'frozen', ySplit: 5 }],
        pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });

    sheet.columns = [
        { key: 'label', width: 44 },
        { key: 'formula', width: 70 },
        { key: 'value', width: 18 },
    ];

    addHeader(sheet, data, 'Memória de cálculo — Apuração de impostos', 'C');
    sheet.getRow(4).height = 6;

    styleHeaderRow(sheet.addRow(['Descrição', 'Memória de cálculo', 'Valor']));

    (data.memory || []).forEach((section) => {
        sheet.addRow([]);

        const titleRow = sheet.addRow([section.title]);
        sheet.mergeCells(`A${titleRow.number}:C${titleRow.number}`);
        titleRow.getCell(1).font = { bold: true, color: { argb: COLORS.sectionText } };
        titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.section } };

        section.lines.forEach((line) => {
            const row = sheet.addRow([line.label, line.formula || '', line.value]);
            const isNumber = typeof line.value === 'number';

            row.getCell(1).alignment = { indent: line.kind === 'sub' ? 2 : 0, vertical: 'top' };
            row.getCell(2).alignment = { wrapText: true, vertical: 'top' };
            row.getCell(2).font = { size: 9, color: { argb: COLORS.muted } };
            row.getCell(3).alignment = { horizontal: 'right', vertical: 'top' };
            if (isNumber) row.getCell(3).numFmt = MONEY_FORMAT;

            if (line.kind === 'total') {
                [1, 3].forEach((index) => { row.getCell(index).font = { bold: true }; });
                row.eachCell({ includeEmpty: true }, (cell) => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.total } };
                    cell.border = { top: { style: 'thin', color: { argb: COLORS.border } } };
                });
            }
        });
    });
}

function addSummarySheet(workbook, data) {
    const sheet = workbook.addWorksheet('Resumo por imposto');

    sheet.columns = [
        { key: 'label', width: 34 },
        { key: 'debit', width: 16 },
        { key: 'credit', width: 16 },
        { key: 'balance', width: 16 },
        { key: 'toPay', width: 16 },
        { key: 'creditBalance', width: 16 },
        { key: 'note', width: 48 },
    ];

    addHeader(sheet, data, 'Resumo por imposto', 'G');
    sheet.addRow([]);
    styleHeaderRow(sheet.addRow(['Imposto', 'Débito', 'Crédito', 'Saldo', 'A recolher', 'Saldo credor', 'Observação']));

    (data.byTax || []).forEach((row) => {
        sheet.addRow([
            row.label + (row.estimated ? ' (estimado)' : ''),
            row.debit, row.credit, row.balance, row.toPay, row.creditBalance, row.note || '',
        ]);
    });

    const summary = data.summary || {};
    const totalRow = sheet.addRow([
        'TOTAL', summary.debits, summary.credits,
        Math.round((num(summary.debits) - num(summary.credits)) * 100) / 100, summary.toPay, summary.creditBalance, '',
    ]);
    totalRow.font = { bold: true };
    totalRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.total } };
    });

    sheet.getColumn(2).numFmt = MONEY_FORMAT;
    sheet.getColumn(3).numFmt = MONEY_FORMAT;
    sheet.getColumn(4).numFmt = MONEY_FORMAT;
    sheet.getColumn(5).numFmt = MONEY_FORMAT;
    sheet.getColumn(6).numFmt = MONEY_FORMAT;
}

function addOriginsSheet(workbook, data) {
    const sheet = workbook.addWorksheet('Créditos por origem');

    sheet.columns = [
        { key: 'label', width: 40 },
        { key: 'value', width: 18 },
        { key: 'share', width: 12 },
    ];

    addHeader(sheet, data, 'Créditos por origem', 'C');
    sheet.addRow([]);
    styleHeaderRow(sheet.addRow(['Origem', 'Valor', '% do total']));

    const origins = data.creditOrigins || [];
    const total = origins.reduce((sum, origin) => sum + num(origin.value), 0);

    origins.forEach((origin) => {
        sheet.addRow([
            origin.label + (origin.estimated ? ' (estimado)' : ''),
            origin.value,
            total > 0 ? num(origin.value) / total : 0,
        ]);
    });

    const totalRow = sheet.addRow(['TOTAL', total, total > 0 ? 1 : 0]);
    totalRow.font = { bold: true };

    sheet.getColumn(2).numFmt = MONEY_FORMAT;
    sheet.getColumn(3).numFmt = '0.0%';
}


// ======================================================================
// PDF
// ======================================================================

const PAGE = Object.freeze({
    margin: 40,
    labelWidth: 170,
    valueWidth: 95,
    gap: 10,
});

// Standard PDF fonts are WinAnsi: no U+2212 minus sign.
function pdfText(value) {
    return String(value ?? '').replace(/−/g, '-');
}

export function buildAssessmentPdf(data) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'A4',
            margin: PAGE.margin,
            bufferPages: true,
            info: { Title: 'Memória de cálculo — Apuração', Author: 'CONSART ERP' },
        });

        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        try {
            writePdf(doc, data);
            addPageNumbers(doc);
            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

function writePdf(doc, data) {
    const left = PAGE.margin;
    const width = doc.page.width - PAGE.margin * 2;
    const formulaX = left + PAGE.labelWidth + PAGE.gap;
    const formulaWidth = width - PAGE.labelWidth - PAGE.valueWidth - PAGE.gap * 2;
    const valueX = left + width - PAGE.valueWidth;
    const bottom = () => doc.page.height - PAGE.margin - 20;

    // ---------------- HEADER ----------------
    doc.font('Helvetica-Bold').fontSize(16).fillColor(`#${COLORS.title}`)
        .text('Memória de cálculo — Apuração de impostos', left, PAGE.margin, { width });
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(10).fillColor('#334155')
        .text(pdfText(`Período: ${periodText(data)}`), { width })
        .text(pdfText(`Regime: ${data.regime?.summary || data.regime?.label || 'sem regime cadastrado'}`), { width });
    doc.fontSize(8).fillColor(`#${COLORS.muted}`)
        .text(`Gerado em ${generatedAt()} · valores estimados, conferir com a contabilidade`, { width });
    doc.moveDown(0.8);

    const ensureSpace = (height) => {
        if (doc.y + height > bottom()) {
            doc.addPage();
            doc.y = PAGE.margin;
        }
    };

    // ---------------- SECTIONS ----------------
    (data.memory || []).forEach((section) => {
        ensureSpace(40);

        const titleY = doc.y;
        doc.rect(left, titleY, width, 18).fill(`#${COLORS.section}`);
        doc.font('Helvetica-Bold').fontSize(10).fillColor(`#${COLORS.sectionText}`)
            .text(pdfText(section.title), left + 6, titleY + 5, { width: width - 12 });
        doc.y = titleY + 22;

        section.lines.forEach((line) => {
            const indent = line.kind === 'sub' ? 12 : 0;
            const isTotal = line.kind === 'total';
            const labelFont = isTotal ? 'Helvetica-Bold' : 'Helvetica';
            const label = pdfText(line.label);
            const formula = pdfText(line.formula);
            const value = typeof line.value === 'number' ? pdfText(brl(line.value)) : pdfText(line.value);
            const valueIsText = typeof line.value !== 'number';

            doc.font(labelFont).fontSize(9);
            const labelHeight = doc.heightOfString(label, { width: PAGE.labelWidth - indent });
            doc.font('Helvetica').fontSize(8);
            const formulaHeight = formula ? doc.heightOfString(formula, { width: formulaWidth }) : 0;
            doc.font(labelFont).fontSize(9);
            const valueWidth = valueIsText ? formulaWidth + PAGE.valueWidth : PAGE.valueWidth;
            const valueHeight = doc.heightOfString(value, { width: valueWidth });
            const textHeight = valueIsText
                ? Math.max(labelHeight, valueHeight + (formula ? formulaHeight + 2 : 0))
                : Math.max(labelHeight, formulaHeight, valueHeight);
            const rowHeight = textHeight + 6;

            ensureSpace(rowHeight);
            const y = doc.y;

            if (isTotal) {
                doc.rect(left, y - 1, width, rowHeight).fill(`#${COLORS.total}`);
            }

            doc.font(labelFont).fontSize(9).fillColor('#0f172a')
                .text(label, left + indent + 4, y + 2, { width: PAGE.labelWidth - indent - 4 });

            if (valueIsText) {
                doc.font(labelFont).fontSize(9).fillColor('#0f172a')
                    .text(value, formulaX, y + 2, { width: valueWidth });
                if (formula) {
                    doc.font('Helvetica').fontSize(8).fillColor(`#${COLORS.muted}`)
                        .text(formula, formulaX, y + 4 + valueHeight, { width: valueWidth });
                }
            } else {
                if (formula) {
                    doc.font('Helvetica').fontSize(8).fillColor(`#${COLORS.muted}`)
                        .text(formula, formulaX, y + 3, { width: formulaWidth });
                }
                doc.font(labelFont).fontSize(9).fillColor(line.value < 0 ? '#be123c' : '#0f172a')
                    .text(value, valueX, y + 2, { width: PAGE.valueWidth - 4, align: 'right' });
            }

            doc.moveTo(left, y + rowHeight - 1).lineTo(left + width, y + rowHeight - 1)
                .lineWidth(0.4).strokeColor('#e2e8f0').stroke();
            doc.y = y + rowHeight;
        });

        doc.y += 10;
    });
}

function addPageNumbers(doc) {
    const range = doc.bufferedPageRange();

    for (let index = range.start; index < range.start + range.count; index += 1) {
        doc.switchToPage(index);
        // Writing below the bottom margin would otherwise open a new page.
        doc.page.margins.bottom = 0;
        doc.font('Helvetica').fontSize(8).fillColor(`#${COLORS.muted}`)
            .text(
                `Página ${index + 1} de ${range.count}`,
                PAGE.margin,
                doc.page.height - PAGE.margin,
                { width: doc.page.width - PAGE.margin * 2, align: 'right', lineBreak: false }
            );
    }
}
