// ╔══════════════════════════════════════════════════════════════════════╗
// ║ generationReportsSuppliersExcel.js — Relatório de Fornecedores     ║
// ║ CONSART ERP · ExcelJS · ESM                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import ExcelJS from 'exceljs';

const COLORS = Object.freeze({
    header: 'FF1D4ED8',
    headerText: 'FFFFFFFF',
    border: 'FFD1D5DB',
    zebra: 'FFF8FAFC',
    active: 'FF166534',
    inactive: 'FF991B1B',
});

function text(value) {
    return value === undefined || value === null ? '' : String(value).trim();
}

function onlyDigits(value) {
    return text(value).replace(/\D+/g, '');
}

function formatTaxId(value) {
    const digits = onlyDigits(value);

    if (digits.length === 14) {
        return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    }

    if (digits.length === 11) {
        return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
    }

    return text(value);
}

function formatStatus(value) {
    const status = text(value).toUpperCase();
    return ['INACTIVE', 'INATIVO', 'FALSE', '0'].includes(status) ? 'Inativo' : 'Ativo';
}

function normalizeSupplier(supplier = {}) {
    return {
        supplierId: supplier.supplier_id ?? supplier.id ?? '',
        name: text(supplier.name ?? supplier.supplier_name),
        taxId: formatTaxId(supplier.tax_id ?? supplier.cnpj_cpf),
        city: text(supplier.city),
        state: text(supplier.state ?? supplier.uf).toUpperCase(),
        phone: text(supplier.phone),
        email: text(supplier.email),
        status: formatStatus(supplier.status ?? supplier.active ?? supplier.is_active),
    };
}

/**
 * Gera o relatório de fornecedores em formato XLSX.
 *
 * @param {Array<object>} suppliers Fornecedores retornados pelo banco.
 * @param {object} [options]
 * @param {string} [options.title='Relatório de Fornecedores']
 * @param {Date|string} [options.generatedAt=new Date()]
 * @returns {Promise<Buffer>}
 */
export async function generateReportsSuppliersExcel(
    suppliers = [],
    options = {},
) {
    if (!Array.isArray(suppliers)) {
        throw new TypeError('suppliers deve ser um array.');
    }

    const title = text(options.title) || 'Relatório de Fornecedores';
    const generatedAt = new Date(options.generatedAt ?? Date.now());
    const rows = suppliers.map(normalizeSupplier);
    const workbook = new ExcelJS.Workbook();

    workbook.creator = 'CONSART ERP';
    workbook.created = Number.isNaN(generatedAt.getTime()) ? new Date() : generatedAt;
    workbook.modified = new Date();

    const worksheet = workbook.addWorksheet('Fornecedores', {
        views: [{ state: 'frozen', ySplit: 3 }],
        pageSetup: {
            paperSize: 9,
            orientation: 'landscape',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
        },
    });

    worksheet.mergeCells('A1:H1');
    worksheet.getCell('A1').value = title;
    worksheet.getCell('A1').font = { bold: true, size: 16, color: COLORS.header };
    worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 26;

    worksheet.mergeCells('A2:H2');
    worksheet.getCell('A2').value = `Gerado em: ${workbook.created.toLocaleString('pt-BR')}`;
    worksheet.getCell('A2').font = { italic: true, size: 9, color: 'FF475569' };
    worksheet.getCell('A2').alignment = { horizontal: 'right' };

    worksheet.columns = [
        { key: 'supplierId', width: 10 },
        { key: 'name', width: 42 },
        { key: 'taxId', width: 20 },
        { key: 'city', width: 24 },
        { key: 'state', width: 10 },
        { key: 'phone', width: 19 },
        { key: 'email', width: 34 },
        { key: 'status', width: 12 },
    ];

    const headerRow = worksheet.getRow(3);
    headerRow.values = ['#', 'Nome', 'CNPJ / CPF', 'Cidade', 'Estado', 'Telefone', 'Email', 'Status'];
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: COLORS.headerText };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.header } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
            top: { style: 'thin', color: { argb: COLORS.border } },
            left: { style: 'thin', color: { argb: COLORS.border } },
            bottom: { style: 'thin', color: { argb: COLORS.border } },
            right: { style: 'thin', color: { argb: COLORS.border } },
        };
    });

    for (const [index, supplier] of rows.entries()) {
        const row = worksheet.addRow(supplier);
        row.height = 20;

        row.eachCell({ includeEmpty: true }, (cell) => {
            cell.alignment = { vertical: 'middle', wrapText: false };
            cell.border = {
                bottom: { style: 'hair', color: { argb: COLORS.border } },
            };

            if (index % 2 === 1) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.zebra } };
            }
        });

        row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(8).font = {
            bold: true,
            color: supplier.status === 'Ativo' ? COLORS.active : COLORS.inactive,
        };
    }

    worksheet.autoFilter = { from: 'A3', to: `H${Math.max(3, rows.length + 3)}` };
    worksheet.pageSetup.printTitlesRow = '1:3';
    worksheet.headerFooter.oddFooter = `&LTotal: ${rows.length} fornecedor(es)&RPágina &P de &N`;

    const output = await workbook.xlsx.writeBuffer();
    return Buffer.from(output);
}

export default generateReportsSuppliersExcel;
