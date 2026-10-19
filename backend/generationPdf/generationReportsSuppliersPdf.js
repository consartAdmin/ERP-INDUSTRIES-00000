// ╔══════════════════════════════════════════════════════════════════════╗
// ║ generationReportsSuppliersPdf.js — Relatório de Fornecedores       ║
// ║ CONSART ERP · PDFKit · ESM                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import PDFDocument from 'pdfkit';

const COLOR = Object.freeze({
    text: '#172033',
    muted: '#64748B',
    header: '#1D4ED8',
    headerText: '#FFFFFF',
    border: '#CBD5E1',
    zebra: '#F8FAFC',
    active: '#166534',
    inactive: '#991B1B',
});

const COLUMNS = Object.freeze([
    { key: 'supplierId', label: '#', width: 38, align: 'center' },
    { key: 'name', label: 'Nome', width: 174, align: 'left' },
    { key: 'taxId', label: 'CNPJ / CPF', width: 103, align: 'left' },
    { key: 'city', label: 'Cidade', width: 105, align: 'left' },
    { key: 'state', label: 'UF', width: 30, align: 'center' },
    { key: 'phone', label: 'Telefone', width: 86, align: 'left' },
    { key: 'email', label: 'Email', width: 152, align: 'left' },
    { key: 'status', label: 'Status', width: 55, align: 'center' },
]);

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
        supplierId: text(supplier.supplier_id ?? supplier.id),
        name: text(supplier.name ?? supplier.supplier_name),
        taxId: formatTaxId(supplier.tax_id ?? supplier.cnpj_cpf),
        city: text(supplier.city),
        state: text(supplier.state ?? supplier.uf).toUpperCase(),
        phone: text(supplier.phone),
        email: text(supplier.email),
        status: formatStatus(supplier.status ?? supplier.active ?? supplier.is_active),
    };
}

function truncate(doc, value, width) {
    const original = text(value);
    if (doc.widthOfString(original) <= width) return original;

    let output = original;
    while (output && doc.widthOfString(`${output}…`) > width) {
        output = output.slice(0, -1);
    }

    return `${output}…`;
}

/**
 * Gera o relatório de fornecedores em formato PDF.
 *
 * @param {Array<object>} suppliers Fornecedores retornados pelo banco.
 * @param {object} [options]
 * @param {string} [options.title='Relatório de Fornecedores']
 * @param {Date|string} [options.generatedAt=new Date()]
 * @returns {Promise<Buffer>}
 */
export function generateReportsSuppliersPdf(suppliers = [], options = {}) {
    if (!Array.isArray(suppliers)) {
        return Promise.reject(new TypeError('suppliers deve ser um array.'));
    }

    const title = text(options.title) || 'Relatório de Fornecedores';
    const parsedDate = new Date(options.generatedAt ?? Date.now());
    const generatedAt = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
    const rows = suppliers.map(normalizeSupplier);

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'A4',
            layout: 'landscape',
            margins: { top: 32, right: 28, bottom: 34, left: 28 },
            bufferPages: true,
            info: {
                Title: title,
                Author: 'CONSART ERP',
                Subject: 'Relatório de fornecedores',
            },
        });

        const chunks = [];
        const rowHeight = 22;
        const headerHeight = 24;
        const tableLeft = doc.page.margins.left;
        const tableWidth = COLUMNS.reduce((total, column) => total + column.width, 0);

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('error', reject);
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        function drawPageHeading() {
            doc.fillColor(COLOR.header).font('Helvetica-Bold').fontSize(15)
                .text(title, tableLeft, 28, { width: tableWidth, align: 'left' });

            doc.fillColor(COLOR.muted).font('Helvetica').fontSize(8)
                .text(`Gerado em: ${generatedAt.toLocaleString('pt-BR')}`, tableLeft, 31, {
                    width: tableWidth,
                    align: 'right',
                });

            doc.moveTo(tableLeft, 50).lineTo(tableLeft + tableWidth, 50)
                .strokeColor(COLOR.header).lineWidth(1).stroke();
        }

        function drawTableHeader(y) {
            doc.rect(tableLeft, y, tableWidth, headerHeight).fill(COLOR.header);

            let x = tableLeft;
            doc.font('Helvetica-Bold').fontSize(8).fillColor(COLOR.headerText);

            for (const column of COLUMNS) {
                doc.text(column.label, x + 4, y + 8, {
                    width: column.width - 8,
                    align: column.align,
                    lineBreak: false,
                });
                x += column.width;
            }

            return y + headerHeight;
        }

        function startPage(addPage = false) {
            if (addPage) doc.addPage();
            drawPageHeading();
            return drawTableHeader(58);
        }

        let y = startPage(false);

        if (!rows.length) {
            doc.rect(tableLeft, y, tableWidth, 34).strokeColor(COLOR.border).stroke();
            doc.fillColor(COLOR.muted).font('Helvetica').fontSize(9)
                .text('Nenhum fornecedor encontrado.', tableLeft, y + 12, {
                    width: tableWidth,
                    align: 'center',
                });
        }

        rows.forEach((supplier, index) => {
            const bottomLimit = doc.page.height - doc.page.margins.bottom - 16;
            if (y + rowHeight > bottomLimit) y = startPage(true);

            if (index % 2 === 1) {
                doc.rect(tableLeft, y, tableWidth, rowHeight).fill(COLOR.zebra);
            }

            doc.rect(tableLeft, y, tableWidth, rowHeight)
                .strokeColor(COLOR.border).lineWidth(0.35).stroke();

            let x = tableLeft;
            doc.font('Helvetica').fontSize(7.5);

            for (const column of COLUMNS) {
                const value = supplier[column.key];
                doc.fillColor(
                    column.key === 'status'
                        ? (value === 'Ativo' ? COLOR.active : COLOR.inactive)
                        : COLOR.text,
                );

                if (column.key === 'status') doc.font('Helvetica-Bold');

                doc.text(truncate(doc, value, column.width - 8), x + 4, y + 8, {
                    width: column.width - 8,
                    align: column.align,
                    lineBreak: false,
                });

                if (column.key === 'status') doc.font('Helvetica');
                x += column.width;
            }

            y += rowHeight;
        });

        const pageRange = doc.bufferedPageRange();
        for (let pageIndex = 0; pageIndex < pageRange.count; pageIndex += 1) {
            doc.switchToPage(pageIndex);
            doc.fillColor(COLOR.muted).font('Helvetica').fontSize(8)
                .text(`Total: ${rows.length} fornecedor(es)`, tableLeft, doc.page.height - 24, {
                    width: tableWidth / 2,
                    align: 'left',
                })
                .text(`Página ${pageIndex + 1} de ${pageRange.count}`, tableLeft + tableWidth / 2, doc.page.height - 24, {
                    width: tableWidth / 2,
                    align: 'right',
                });
        }

        doc.end();
    });
}

export default generateReportsSuppliersPdf;
