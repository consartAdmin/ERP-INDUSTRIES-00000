// ╔══════════════════════════════════════════════════════════════════════╗
// ║ generationAccountsPayableExcel.js — Exportação Excel                ║
// ║ CONSART ERP — Contas a Pagar                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

import ExcelJS from 'exceljs';
import { list } from '../repositories/accountsPayable/accountsPayable.index.js';

const EXPORT_PAGE_SIZE = 200;
const MAX_EXPORT_ROWS = 50000;

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

function formatStatus(value) {
    const status = String(value || '')
        .trim()
        .toUpperCase();

    return STATUS_LABELS[status] || status || '-';
}

/**
 * Converte uma data para um Date compatível com ExcelJS.
 *
 * Suporta:
 * - Date
 * - 2026-09-10
 * - 2026-09-10T00:00:00.000Z
 * - 10/09/2026
 *
 * Mantém somente a parte da data, evitando alteração por timezone.
 */
function toExcelDate(value) {
    if (!value) return null;

    /* -------------------------------------------------------------
     * Já é Date
     * ------------------------------------------------------------- */

    if (
        value instanceof Date &&
        !Number.isNaN(value.getTime())
    ) {
        return new Date(
            Date.UTC(
                value.getUTCFullYear(),
                value.getUTCMonth(),
                value.getUTCDate(),
                12,
                0,
                0
            )
        );
    }

    const raw = String(value).trim();

    /* -------------------------------------------------------------
     * ISO / PostgreSQL
     * ------------------------------------------------------------- */

    const isoMatch = raw.match(
        /^(\d{4})-(\d{2})-(\d{2})/
    );

    if (isoMatch) {
        const [, year, month, day] = isoMatch;

        return new Date(
            Date.UTC(
                Number(year),
                Number(month) - 1,
                Number(day),
                12,
                0,
                0
            )
        );
    }

    /* -------------------------------------------------------------
     * Brasileiro
     * ------------------------------------------------------------- */

    const brMatch = raw.match(
        /^(\d{2})\/(\d{2})\/(\d{4})/
    );

    if (brMatch) {
        const [, day, month, year] = brMatch;

        return new Date(
            Date.UTC(
                Number(year),
                Number(month) - 1,
                Number(day),
                12,
                0,
                0
            )
        );
    }

    /* -------------------------------------------------------------
     * Última tentativa
     * ------------------------------------------------------------- */

    const parsed = new Date(raw);

    if (!Number.isNaN(parsed.getTime())) {
        return new Date(
            Date.UTC(
                parsed.getUTCFullYear(),
                parsed.getUTCMonth(),
                parsed.getUTCDate(),
                12,
                0,
                0
            )
        );
    }

    return null;
}

function formatDateBR(value) {
    const date = toExcelDate(value);

    if (!date) return '';

    const day = String(
        date.getUTCDate()
    ).padStart(2, '0');

    const month = String(
        date.getUTCMonth() + 1
    ).padStart(2, '0');

    const year = date.getUTCFullYear();

    return `${day}/${month}/${year}`;
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
        search:
            filters.search ||
            undefined,

        status:
            filters.status ||
            undefined,

        supplierId:
            filters.supplierId ||
            undefined,

        fromDueDate:
            filters.fromDueDate ||
            undefined,

        toDueDate:
            filters.toDueDate ||
            undefined,

        month:
            filters.month ||
            undefined,

        year:
            filters.year ||
            undefined,

        orderBy:
            filters.orderBy ||
            'due_date asc',
    };
}

function buildFilterDescription(filters = {}) {
    const parts = [];

    if (filters.search) {
        parts.push(
            `Busca: ${filters.search}`
        );
    }

    if (filters.status) {
        parts.push(
            `Status: ${formatStatus(filters.status)}`
        );
    }

    if (filters.month) {
        parts.push(
            `Mês: ${String(filters.month).padStart(2, '0')}`
        );
    }

    if (filters.year) {
        parts.push(
            `Ano: ${filters.year}`
        );
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
        ? parts.join(' | ')
        : 'Filtros: todos os registros';
}

/* =====================================================================
 * Carregar todos os registros
 * ===================================================================== */

async function loadAllRows(filters = {}) {
    const normalized =
        normalizeFilters(filters);

    const rows = [];

    let page = 1;
    let total = 0;

    do {
        const result = await list({
            ...normalized,
            page,
            pageSize: EXPORT_PAGE_SIZE,
        });

        const chunk =
            Array.isArray(result?.rows)
                ? result.rows
                : [];

        total =
            Number(
                result?.total ||
                chunk.length
            );

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

    return rows.slice(
        0,
        MAX_EXPORT_ROWS
    );
}

/* =====================================================================
 * Nome do arquivo
 * ===================================================================== */

function makeFilename() {
    const stamp =
        new Date()
            .toISOString()
            .slice(0, 10)
            .replaceAll('-', '');

    return `contas-a-pagar-${stamp}.xlsx`;
}

/* =====================================================================
 * Bordas
 * ===================================================================== */

const thinBorder = {
    top: {
        style: 'thin',
        color: { argb: 'FFD0D0D0' },
    },

    left: {
        style: 'thin',
        color: { argb: 'FFD0D0D0' },
    },

    bottom: {
        style: 'thin',
        color: { argb: 'FFD0D0D0' },
    },

    right: {
        style: 'thin',
        color: { argb: 'FFD0D0D0' },
    },
};

/* =====================================================================
 * Estilo de status
 * ===================================================================== */

function styleStatusCell(cell, status) {
    const normalized =
        String(status || '')
            .trim()
            .toUpperCase();

    switch (normalized) {
        case 'PAID':
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: {
                    argb: 'FFE2F0D9',
                },
            };

            cell.font = {
                color: {
                    argb: 'FF375623',
                },
                bold: true,
            };
            break;

        case 'OVERDUE':
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: {
                    argb: 'FFFCE4D6',
                },
            };

            cell.font = {
                color: {
                    argb: 'FFC00000',
                },
                bold: true,
            };
            break;

        case 'PARTIAL':
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: {
                    argb: 'FFFFF2CC',
                },
            };

            cell.font = {
                color: {
                    argb: 'FF7F6000',
                },
                bold: true,
            };
            break;

        case 'CANCELLED':
        case 'CANCELED':
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: {
                    argb: 'FFE7E6E6',
                },
            };

            cell.font = {
                color: {
                    argb: 'FF666666',
                },
                italic: true,
            };
            break;

        default:
            break;
    }
}

/* =====================================================================
 * Exportação Excel
 * ===================================================================== */

export async function generateAccountsPayableExcel(filters = {}) {

    const rows =
        await loadAllRows(filters);

    /* =================================================================
     * Workbook
     * ================================================================= */

    const workbook =
        new ExcelJS.Workbook();

    workbook.creator =
        'CONSART ERP';

    workbook.lastModifiedBy =
        'CONSART ERP';

    workbook.created =
        new Date();

    workbook.modified =
        new Date();

    workbook.company =
        'CONSART';

    /* =================================================================
     * Worksheet
     * ================================================================= */

    const sheet =
        workbook.addWorksheet(
            'Contas a Pagar',
            {
                views: [
                    {
                        state: 'frozen',

                        /*
                         * Congela tudo acima da linha 6.
                         * A linha 5 é o cabeçalho.
                         */
                        ySplit: 5,
                    },
                ],

                pageSetup: {
                    orientation: 'landscape',

                    fitToPage: true,
                    fitToWidth: 1,
                    fitToHeight: 0,

                    /*
                     * A4
                     */
                    paperSize: 9,

                    margins: {
                        left: 0.25,
                        right: 0.25,
                        top: 0.5,
                        bottom: 0.5,
                        header: 0.2,
                        footer: 0.2,
                    },
                },
            }
        );

    /* =================================================================
     * Colunas
     * ================================================================= */

    sheet.columns = [
        {
            key: 'id',
            width: 10,
        },
        {
            key: 'issue_date',
            width: 13,
        },
        {
            key: 'due_date',
            width: 13,
        },
        {
            key: 'supplier_name',
            width: 34,
        },
        {
            key: 'invoice_number',
            width: 18,
        },
        {
            key: 'document_number',
            width: 20,
        },
        {
            key: 'description',
            width: 38,
        },
        {
            key: 'category_name',
            width: 24,
        },
        {
            key: 'subcategory_name',
            width: 24,
        },
        {
            key: 'payment_method_name',
            width: 24,
        },
        {
            key: 'total_value',
            width: 16,
        },
        {
            key: 'amount_paid',
            width: 16,
        },
        {
            key: 'balance',
            width: 16,
        },
        {
            key: 'status',
            width: 16,
        },
        {
            key: 'payment_date',
            width: 15,
        },
        {
            key: 'source_type',
            width: 16,
        },
        {
            key: 'source_id',
            width: 13,
        },
        {
            key: 'attachments_count',
            width: 10,
        },
        {
            key: 'notes',
            width: 45,
        },
    ];

    const COLUMN_COUNT =
        sheet.columnCount;

    /* =================================================================
     * Linha 1 — Título
     * ================================================================= */

    sheet.mergeCells('A1:S1');

    const titleCell = sheet.getCell('A1');

    titleCell.value = 'CONSART ERP — CONTAS A PAGAR';

    titleCell.font = {
        bold: true,
        size: 16,
        color: {
            argb: 'FF1F1F1F',
        },
    };

    titleCell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
    };

    sheet.getRow(1).height = 28;

    /* =================================================================
     * Linha 2 — Gerado em
     * ================================================================= */

    sheet.mergeCells(
        2,
        1,
        2,
        COLUMN_COUNT
    );

    const generatedCell =
        sheet.getCell(2, 1);

    generatedCell.value =
        `Gerado em ${new Date().toLocaleString(
            'pt-BR',
            {
                timeZone:
                    'America/Sao_Paulo',
            }
        )}`;

    generatedCell.font = {
        size: 9,
        color: {
            argb: 'FF666666',
        },
    };

    generatedCell.alignment = {
        vertical: 'middle',
        horizontal: 'left',
    };

    /* =================================================================
     * Linha 3 — Filtros
     * ================================================================= */

    sheet.mergeCells(
        3,
        1,
        3,
        COLUMN_COUNT
    );

    const filterCell =
        sheet.getCell(3, 1);

    filterCell.value =
        buildFilterDescription(filters);

    filterCell.font = {
        size: 9,
        italic: true,
        color: {
            argb: 'FF666666',
        },
    };

    /* =================================================================
     * Linha 4 — Espaço
     * ================================================================= */

    sheet.getRow(4).height = 7;

    /* =================================================================
     * Linha 5 — Cabeçalho
     * ================================================================= */

    const HEADER_ROW = 5;

    const headers = [
        'ID',
        'Emissão',
        'Vencimento',
        'Fornecedor',
        'NF / Fatura',
        'Documento',
        'Descrição',
        'Categoria',
        'Subcategoria',
        'Forma Pagamento',
        'Valor Total',
        'Valor Pago',
        'Saldo',
        'Status',
        'Data Pagamento',
        'Origem',
        'ID Origem',
        'Anexos',
        'Observações',
    ];

    const headerRow =
        sheet.getRow(HEADER_ROW);

    headers.forEach(
        (headerText, index) => {
            const cell =
                headerRow.getCell(
                    index + 1
                );

            cell.value =
                headerText;

            cell.font = {
                bold: true,
                size: 10,
                color: {
                    argb: 'FF1F1F1F',
                },
            };

            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: {
                    argb: 'FFD9E2F3',
                },
            };

            cell.alignment = {
                vertical: 'middle',
                horizontal: 'center',
            };

            cell.border =
                thinBorder;
        }
    );

    headerRow.height = 25;

    /* =================================================================
     * Dados
     * ================================================================= */

    const DATA_START_ROW =
        HEADER_ROW + 1;

    for (const item of rows) {

        const row =
            sheet.addRow({
                id:
                    item.id,

                issue_date:
                    toExcelDate(
                        item.issue_date
                    ),

                due_date:
                    toExcelDate(
                        item.due_date
                    ),

                supplier_name:
                    item.supplier_name ||
                    '',

                invoice_number:
                    item.invoice_number ||
                    '',

                document_number:
                    item.document_number ||
                    '',

                description:
                    item.description ||
                    '',

                category_name:
                    item.category_name ||
                    '',

                subcategory_name:
                    item.subcategory_name ||
                    '',

                payment_method_name:
                    item.payment_method_name ||
                    '',

                total_value:
                    toNumber(
                        item.total_value
                    ),

                amount_paid:
                    toNumber(
                        item.amount_paid
                    ),

                balance:
                    getBalance(item),

                status:
                    formatStatus(
                        item.status
                    ),

                payment_date:
                    toExcelDate(
                        item.payment_date
                    ),

                source_type:
                    item.source_type ||
                    '',

                source_id:
                    item.source_id ??
                    '',

                attachments_count:
                    toNumber(
                        item.attachments_count
                    ),

                notes:
                    item.notes ||
                    '',
            });

        /* -------------------------------------------------------------
         * Altura
         * ------------------------------------------------------------- */

        row.height = 21;

        /* -------------------------------------------------------------
         * Estilo geral
         * ------------------------------------------------------------- */

        row.eachCell(
            {
                includeEmpty: true,
            },
            (cell) => {

                cell.border =
                    thinBorder;

                cell.alignment = {
                    vertical: 'middle',
                };
            }
        );

        /* -------------------------------------------------------------
         * Zebra
         * ------------------------------------------------------------- */

        if (
            (row.number - DATA_START_ROW) %
            2 ===
            1
        ) {
            row.eachCell(
                {
                    includeEmpty: true,
                },
                (cell) => {

                    if (!cell.fill?.type) {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: {
                                argb:
                                    'FFF8F9FA',
                            },
                        };
                    }
                }
            );
        }

        /* -------------------------------------------------------------
         * Datas centralizadas
         * ------------------------------------------------------------- */

        row.getCell(2).alignment = {
            vertical: 'middle',
            horizontal: 'center',
        };

        row.getCell(3).alignment = {
            vertical: 'middle',
            horizontal: 'center',
        };

        row.getCell(15).alignment = {
            vertical: 'middle',
            horizontal: 'center',
        };

        /* -------------------------------------------------------------
         * Valores à direita
         * ------------------------------------------------------------- */

        [11, 12, 13].forEach(
            (column) => {
                row.getCell(
                    column
                ).alignment = {
                    vertical: 'middle',
                    horizontal: 'right',
                };
            }
        );

        /* -------------------------------------------------------------
         * Campos maiores
         * ------------------------------------------------------------- */

        row.getCell(7).alignment = {
            vertical: 'top',
            wrapText: true,
        };

        row.getCell(19).alignment = {
            vertical: 'top',
            wrapText: true,
        };

        /* -------------------------------------------------------------
         * Status
         * ------------------------------------------------------------- */

        const statusCell =
            row.getCell(14);

        statusCell.alignment = {
            vertical: 'middle',
            horizontal: 'center',
        };

        styleStatusCell(
            statusCell,
            item.status
        );
    }

    /* =================================================================
     * AutoFilter
     * ================================================================= */

    const DATA_END_ROW =
        Math.max(
            HEADER_ROW,
            sheet.rowCount
        );

    sheet.autoFilter = {
        from: {
            row: HEADER_ROW,
            column: 1,
        },

        to: {
            row: DATA_END_ROW,
            column: COLUMN_COUNT,
        },
    };

    /* =================================================================
     * Formatos de data
     * ================================================================= */

    [
        'issue_date',
        'due_date',
        'payment_date',
    ].forEach((key) => {

        sheet.getColumn(
            key
        ).numFmt =
            'dd/mm/yyyy';
    });

    /* =================================================================
     * Formatos monetários
     * ================================================================= */

    [
        'total_value',
        'amount_paid',
        'balance',
    ].forEach((key) => {

        sheet.getColumn(
            key
        ).numFmt =
            'R$ #,##0.00;[Red]-R$ #,##0.00';
    });

    /* =================================================================
     * Totais
     * ================================================================= */

    const TOTAL_ROW_NUMBER =
        sheet.rowCount + 2;

    const totalRow =
        sheet.getRow(
            TOTAL_ROW_NUMBER
        );

    totalRow.height = 24;

    /* -------------------------------------------------------------
     * Quantidade
     * ------------------------------------------------------------- */

    totalRow.getCell(10).value =
        `${rows.length} registro(s)`;

    totalRow.getCell(10).font = {
        bold: true,
    };

    /* -------------------------------------------------------------
     * Fórmulas / valores
     * ------------------------------------------------------------- */

    if (rows.length > 0) {

        const LAST_DATA_ROW =
            DATA_START_ROW +
            rows.length -
            1;

        totalRow.getCell(11).value = {
            formula:
                `SUM(K${DATA_START_ROW}:K${LAST_DATA_ROW})`,
        };

        totalRow.getCell(12).value = {
            formula:
                `SUM(L${DATA_START_ROW}:L${LAST_DATA_ROW})`,
        };

        totalRow.getCell(13).value = {
            formula:
                `SUM(M${DATA_START_ROW}:M${LAST_DATA_ROW})`,
        };

    } else {

        totalRow.getCell(11).value = 0;
        totalRow.getCell(12).value = 0;
        totalRow.getCell(13).value = 0;
    }

    /* -------------------------------------------------------------
     * Estilo dos totais
     * ------------------------------------------------------------- */

    for (
        let column = 10;
        column <= 13;
        column += 1
    ) {
        const cell =
            totalRow.getCell(column);

        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: {
                argb: 'FFE2F0D9',
            },
        };

        cell.border =
            thinBorder;

        cell.font = {
            bold: true,
        };
    }

    [
        11,
        12,
        13,
    ].forEach(
        (column) => {

            totalRow.getCell(
                column
            ).numFmt =
                'R$ #,##0.00;[Red]-R$ #,##0.00';

            totalRow.getCell(
                column
            ).alignment = {
                horizontal: 'right',
            };
        }
    );

    /* =================================================================
     * Impressão
     * ================================================================= */

    sheet.pageSetup.printTitlesRow =
        `${HEADER_ROW}:${HEADER_ROW}`;

    sheet.pageSetup.horizontalCentered =
        true;

    sheet.pageSetup.verticalCentered =
        false;

    /* =================================================================
     * Cabeçalho / rodapé de impressão
     * ================================================================= */

    sheet.headerFooter.oddFooter =
        '&LCONSART ERP&CContas a Pagar&R Página &P de &N';

    sheet.headerFooter.evenFooter =
        '&LCONSART ERP&CContas a Pagar&R Página &P de &N';

    /* =================================================================
     * Finalização
     * ================================================================= */

    const arrayBuffer =
        await workbook.xlsx.writeBuffer();

    const buffer =
        Buffer.from(arrayBuffer);

    return {
        buffer,
        filename:
            makeFilename(),

        rowCount:
            rows.length,
    };
}

export default generateAccountsPayableExcel;