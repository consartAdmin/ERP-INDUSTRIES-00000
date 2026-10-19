// ╔══════════════════════════════════════════════════════════════════════╗
// ║ generationAccountsPayablePdf.js — Exportação PDF                    ║
// ║ CONSART ERP — Contas a Pagar                                        ║
// ║ Layout tabular estilo Excel                                          ║
// ╚══════════════════════════════════════════════════════════════════════╝

import PDFDocument from 'pdfkit';
import { list } from '../repositories/accountsPayable/accountsPayable.index.js';

const EXPORT_PAGE_SIZE = 200;
const MAX_EXPORT_ROWS = 20000;

const STATUS_LABELS = Object.freeze({
    PENDING: 'Pendente',
    PAID: 'Pago',
    OVERDUE: 'Vencido',
    CANCELLED: 'Cancelado',
    CANCELED: 'Cancelado',
    PARTIAL: 'Parcial',
});

/* =====================================================================
 * Helpers
 * ===================================================================== */

function toNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(toNumber(value, 0));
}

/**
 * Converte datas SQL / ISO para DD/MM/AAAA.
 *
 * Importante:
 * não usamos new Date('2026-09-09') para evitar alteração
 * de dia causada por timezone.
 */
function formatDateBR(value) {
    if (!value) return '';

    // ------------------------------------------------------------
    // 1. Quando já é um objeto Date
    // ------------------------------------------------------------
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        const day = String(value.getUTCDate()).padStart(2, '0');
        const month = String(value.getUTCMonth() + 1).padStart(2, '0');
        const year = value.getUTCFullYear();

        return `${day}/${month}/${year}`;
    }

    const raw = String(value).trim();

    // ------------------------------------------------------------
    // 2. PostgreSQL / ISO
    // Ex:
    // 2026-09-10
    // 2026-09-10T00:00:00.000Z
    // ------------------------------------------------------------
    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (isoMatch) {
        const [, year, month, day] = isoMatch;

        return `${day}/${month}/${year}`;
    }

    // ------------------------------------------------------------
    // 3. Quando já está em formato brasileiro
    // ------------------------------------------------------------
    const brMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);

    if (brMatch) {
        const [, day, month, year] = brMatch;

        return `${day}/${month}/${year}`;
    }

    // ------------------------------------------------------------
    // 4. Datas JS em texto
    // Ex:
    // Thu Sep 10 2026 00:00:00 GMT...
    // ------------------------------------------------------------
    const parsed = new Date(raw);

    if (!Number.isNaN(parsed.getTime())) {
        const day = String(parsed.getUTCDate()).padStart(2, '0');
        const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
        const year = parsed.getUTCFullYear();

        return `${day}/${month}/${year}`;
    }

    return '';
}

function formatStatus(value) {
    const status = String(value || '')
        .trim()
        .toUpperCase();

    return STATUS_LABELS[status] || status || '-';
}

function getBalance(row) {
    if (
        row?.balance != null &&
        Number.isFinite(Number(row.balance))
    ) {
        return Number(row.balance);
    }

    return Math.max(
        0,
        toNumber(row?.total_value) -
        toNumber(row?.amount_paid)
    );
}

/* =====================================================================
 * Filtros
 * ===================================================================== */

function normalizeFilters(filters = {}) {
    return {
        search: filters.search || undefined,
        status: filters.status || undefined,
        supplierId: filters.supplierId || undefined,
        fromDueDate: filters.fromDueDate || undefined,
        toDueDate: filters.toDueDate || undefined,
        month: filters.month || undefined,
        year: filters.year || undefined,
        orderBy: filters.orderBy || 'due_date asc',
    };
}

async function loadAllRows(filters = {}) {
    const normalized = normalizeFilters(filters);

    const rows = [];

    let page = 1;
    let total = 0;

    do {
        const result = await list({
            ...normalized,
            page,
            pageSize: EXPORT_PAGE_SIZE,
        });

        const chunk = Array.isArray(result?.rows)
            ? result.rows
            : [];

        total = Number(result?.total || chunk.length);

        rows.push(...chunk);

        if (
            !chunk.length ||
            rows.length >= total ||
            rows.length >= MAX_EXPORT_ROWS
        ) {
            break;
        }

        page += 1;

    } while (true);

    return rows.slice(0, MAX_EXPORT_ROWS);
}

function buildFilterDescription(filters = {}) {
    const parts = [];

    if (filters.search) {
        parts.push(`Busca: ${filters.search}`);
    }

    if (filters.status) {
        parts.push(`Status: ${formatStatus(filters.status)}`);
    }

    if (filters.month) {
        parts.push(
            `Mês: ${String(filters.month).padStart(2, '0')}`
        );
    }

    if (filters.year) {
        parts.push(`Ano: ${filters.year}`);
    }

    if (filters.fromDueDate) {
        parts.push(
            `Venc. inicial: ${formatDateBR(filters.fromDueDate)}`
        );
    }

    if (filters.toDueDate) {
        parts.push(
            `Venc. final: ${formatDateBR(filters.toDueDate)}`
        );
    }

    return parts.length
        ? parts.join('  |  ')
        : 'Filtros: todos os registros';
}

function makeFilename() {
    const stamp = new Date()
        .toISOString()
        .slice(0, 10)
        .replaceAll('-', '');

    return `contas-a-pagar-${stamp}.pdf`;
}

/* =====================================================================
 * Gerador PDF
 * ===================================================================== */

export async function generateAccountsPayablePdf(filters = {}) {

    const rows = await loadAllRows(filters);

    const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',

        margins: {
            top: 32,
            right: 24,
            bottom: 32,
            left: 24,
        },

        bufferPages: true,

        info: {
            Title: 'Contas a Pagar',
            Author: 'CONSART ERP',
            Subject: 'Relatório de Contas a Pagar',
        },
    });

    const chunks = [];

    doc.on('data', (chunk) => {
        chunks.push(chunk);
    });

    /* =================================================================
     * Página
     * ================================================================= */

    const pageWidth = doc.page.width;

    const left = doc.page.margins.left;

    const right =
        pageWidth -
        doc.page.margins.right;

    const tableWidth =
        right -
        left;

    /* =================================================================
     * Colunas
     * ================================================================= */

    const columns = [
        {
            key: 'due_date',
            title: 'Vencimento',
            width: 72,
            align: 'center',
        },
        {
            key: 'supplier_name',
            title: 'Fornecedor',
            width: 155,
            align: 'left',
        },
        {
            key: 'document_number',
            title: 'Documento',
            width: 85,
            align: 'left',
        },
        {
            key: 'description',
            title: 'Descrição',
            width: 155,
            align: 'left',
        },
        {
            key: 'status',
            title: 'Status',
            width: 70,
            align: 'center',
        },
        {
            key: 'total_value',
            title: 'Valor',
            width: 83,
            align: 'right',
        },
        {
            key: 'amount_paid',
            title: 'Pago',
            width: 83,
            align: 'right',
        },
        {
            key: 'balance',
            title: 'Saldo',
            width: 83,
            align: 'right',
        },
    ];

    const naturalWidth = columns.reduce(
        (sum, column) => sum + column.width,
        0
    );

    const scale =
        tableWidth /
        naturalWidth;

    columns.forEach((column) => {
        column.width *= scale;
    });

    /* =================================================================
     * Dimensões da tabela
     * ================================================================= */

    const TABLE_HEADER_HEIGHT = 25;
    const ROW_HEIGHT = 23;

    const TABLE_BORDER_COLOR = '#9E9E9E';
    const TABLE_GRID_COLOR = '#C8C8C8';

    /* =================================================================
     * Cabeçalho relatório
     * ================================================================= */

    function drawReportHeader() {

        doc
            .fillColor('#111111')
            .font('Helvetica-Bold')
            .fontSize(16)
            .text(
                'CONSART ERP — CONTAS A PAGAR',
                left,
                28,
                {
                    width: tableWidth,
                    align: 'left',
                }
            );

        doc
            .font('Helvetica')
            .fontSize(8)
            .fillColor('#555555')
            .text(
                `Gerado em ${new Date().toLocaleString(
                    'pt-BR',
                    {
                        timeZone: 'America/Sao_Paulo',
                    }
                )}`,
                left,
                30,
                {
                    width: tableWidth,
                    align: 'right',
                }
            );

        doc
            .font('Helvetica')
            .fontSize(8)
            .fillColor('#333333')
            .text(
                buildFilterDescription(filters),
                left,
                51,
                {
                    width: tableWidth,
                    align: 'left',
                    ellipsis: true,
                }
            );

        doc
            .moveTo(left, 67)
            .lineTo(right, 67)
            .lineWidth(0.8)
            .strokeColor('#808080')
            .stroke();

        return 76;
    }

    /* =================================================================
     * Cabeçalho da tabela — estilo Excel
     * ================================================================= */

    function drawTableHeader(y) {

        let x = left;

        doc
            .font('Helvetica-Bold')
            .fontSize(8)
            .fillColor('#111111');

        for (const column of columns) {

            /*
             * Fundo da célula
             */
            doc
                .rect(
                    x,
                    y,
                    column.width,
                    TABLE_HEADER_HEIGHT
                )
                .fillAndStroke(
                    '#D9E2F3',
                    TABLE_BORDER_COLOR
                );

            /*
             * Texto
             */
            doc
                .fillColor('#111111')
                .text(
                    column.title,
                    x + 4,
                    y + 8,
                    {
                        width: column.width - 8,
                        align: column.align,
                        lineBreak: false,
                        ellipsis: true,
                    }
                );

            x += column.width;
        }

        return y + TABLE_HEADER_HEIGHT;
    }

    /* =================================================================
     * Linha / célula
     * ================================================================= */

    function drawCell({
        x,
        y,
        width,
        height,
        value,
        align = 'left',
        background = '#FFFFFF',
    }) {

        /*
         * Célula estilo planilha
         */
        doc
            .rect(
                x,
                y,
                width,
                height
            )
            .fillAndStroke(
                background,
                TABLE_GRID_COLOR
            );

        /*
         * Texto
         */
        doc
            .fillColor('#111111')
            .font('Helvetica')
            .fontSize(7.5)
            .text(
                String(value ?? ''),
                x + 4,
                y + 7,
                {
                    width: width - 8,
                    height: height - 8,
                    align,
                    lineBreak: false,
                    ellipsis: true,
                }
            );
    }

    /* =================================================================
     * Nova página
     * ================================================================= */

    function ensureSpace(y, neededHeight) {

        const maxY =
            doc.page.height -
            doc.page.margins.bottom -
            28;

        if (
            y + neededHeight <= maxY
        ) {
            return y;
        }

        doc.addPage({
            size: 'A4',
            layout: 'landscape',

            margins: {
                top: 32,
                right: 24,
                bottom: 32,
                left: 24,
            },
        });

        let newY =
            drawReportHeader();

        newY =
            drawTableHeader(newY);

        return newY;
    }

    /* =================================================================
     * Início
     * ================================================================= */

    let y =
        drawReportHeader();

    y =
        drawTableHeader(y);

    /* =================================================================
     * Registros
     * ================================================================= */

    rows.forEach((row, index) => {

        y = ensureSpace(
            y,
            ROW_HEIGHT
        );

        const values = {

            due_date:
                formatDateBR(
                    row.due_date
                ),

            supplier_name:
                row.supplier_name ||
                '-',

            document_number:
                row.document_number ||
                row.invoice_number ||
                '-',

            description:
                row.description ||
                '-',

            status:
                formatStatus(
                    row.status
                ),

            total_value:
                formatCurrency(
                    row.total_value
                ),

            amount_paid:
                formatCurrency(
                    row.amount_paid
                ),

            balance:
                formatCurrency(
                    getBalance(row)
                ),
        };

        /*
         * Alternância leve estilo planilha
         */
        const background =
            index % 2 === 0
                ? '#FFFFFF'
                : '#F8F9FA';

        let x = left;

        for (const column of columns) {

            drawCell({
                x,
                y,
                width: column.width,
                height: ROW_HEIGHT,
                value: values[column.key],
                align: column.align,
                background,
            });

            x +=
                column.width;
        }

        y +=
            ROW_HEIGHT;
    });

    /* =================================================================
     * Totais
     * ================================================================= */

    y =
        ensureSpace(
            y,
            55
        );

    const totalValue =
        rows.reduce(
            (sum, row) =>
                sum +
                toNumber(
                    row.total_value
                ),
            0
        );

    const amountPaid =
        rows.reduce(
            (sum, row) =>
                sum +
                toNumber(
                    row.amount_paid
                ),
            0
        );

    const balance =
        rows.reduce(
            (sum, row) =>
                sum +
                getBalance(row),
            0
        );

    const TOTAL_ROW_HEIGHT = 26;

    /*
     * Linha de totais estilo Excel
     */
    doc
        .rect(
            left,
            y + 6,
            tableWidth,
            TOTAL_ROW_HEIGHT
        )
        .fillAndStroke(
            '#E2F0D9',
            TABLE_BORDER_COLOR
        );

    doc
        .fillColor('#111111')
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .text(
            `${rows.length} registro(s)`,
            left + 6,
            y + 15,
            {
                width: tableWidth * 0.3,
                align: 'left',
            }
        );

    doc
        .text(
            `Total: ${formatCurrency(totalValue)}   ` +
            `Pago: ${formatCurrency(amountPaid)}   ` +
            `Saldo: ${formatCurrency(balance)}`,
            left,
            y + 15,
            {
                width: tableWidth - 6,
                align: 'right',
            }
        );

    /* =================================================================
     * Numeração de páginas
     * ================================================================= */

    const range = doc.bufferedPageRange();

    for (
        let i = range.start;
        i < range.start + range.count;
        i += 1
    ) {
        doc.switchToPage(i);

        const footerY =
            doc.page.height -
            doc.page.margins.bottom -
            10;

        doc
            .font('Helvetica')
            .fontSize(7)
            .fillColor('#666666')
            .text(
                `Página ${i + 1} de ${range.count}`,
                left,
                footerY,
                {
                    width: tableWidth,
                    align: 'right',
                    lineBreak: false,
                }
            );
    }

    /* =================================================================
     * Finalização
     * ================================================================= */

    doc.end();

    const buffer =
        await new Promise(
            (resolve, reject) => {

                doc.on(
                    'end',
                    () =>
                        resolve(
                            Buffer.concat(chunks)
                        )
                );

                doc.on(
                    'error',
                    reject
                );
            }
        );

    return {
        buffer,
        filename: makeFilename(),
        rowCount: rows.length,
    };
}

export default generateAccountsPayablePdf;