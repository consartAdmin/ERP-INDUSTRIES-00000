// ╔══════════════════════════════════════════════════════════════════════╗
// ║ conciliationSalesxStockController.js                               ║
// ║ CONSART ERP                                                        ║
// ║ Controller + validação da ordenação                                ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
    getSalesStockSummary,
    listSalesStockReconciliation,
} from '../repositories/conciliationSalesxStock/conciliationSalesxStock.index.js';

import {
    generateConciliationSalesxStockPdf,
} from '../generationPdf/generationConciliationSalesxStockPdf.js';

import {
    generateConciliationSalesxStockExcel,
} from '../generationExcel/generationConciliationSalesxStockExcel.js';

const ALLOWED_SORT_COLUMNS = new Set([
    'sku',
    'description',
    'movement_type',
    'invoice_number',
    'movement_date',
    'movement_quantity',
    'stock_after',
    'quantity_to_buy',
]);

function isoDate(value) {
    const date = String(value || '').slice(0, 10);

    return /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? date
        : null;
}

function defaultDates(query = {}) {
    const today = new Date();
    const past = new Date();

    past.setDate(today.getDate() - 30);

    return {
        dateStart:
            isoDate(query.dateStart) ||
            past.toISOString().slice(0, 10),

        dateEnd:
            isoDate(query.dateEnd) ||
            today.toISOString().slice(0, 10),
    };
}

function parseMovementType(value) {
    const movementType = String(value || 'all')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toUpperCase();

    if (
        movementType === 'INBOUND' ||
        movementType === 'ENTRADA'
    ) {
        return 'INBOUND';
    }

    if (
        movementType === 'OUTBOUND' ||
        movementType === 'SAIDA'
    ) {
        return 'OUTBOUND';
    }

    return 'all';
}

function parseSortColumn(value) {
    const normalized = String(
        value || 'movement_date',
    ).trim();

    return ALLOWED_SORT_COLUMNS.has(normalized)
        ? normalized
        : 'movement_date';
}

function parseSortDirection(value) {
    return String(value || 'asc')
        .trim()
        .toLowerCase() === 'desc'
        ? 'desc'
        : 'asc';
}

function parseFilters(query = {}) {
    const viewMode =
        String(query.viewMode || 'operation').toLowerCase() === 'total'
            ? 'total'
            : 'operation';

    return {
        ...defaultDates(query),

        search: String(query.search || '')
            .trim()
            .slice(0, 120),

        movementType:
            parseMovementType(query.movementType),

        onlyNeedBuy:
            String(query.onlyNeedBuy ?? 'true').toLowerCase() !== 'false',

        viewMode,

        sortColumn:
            parseSortColumn(query.sortColumn),

        sortDirection:
            parseSortDirection(query.sortDirection),

        limit: Math.min(
            Math.max(Number(query.limit) || 20, 1),
            200,
        ),

        offset: Math.max(
            Number(query.offset) || 0,
            0,
        ),
    };
}

function exportFilters(query = {}) {
    const filters = parseFilters(query);

    delete filters.limit;
    delete filters.offset;

    return filters;
}

async function loadAllRows(filters) {
    const rows = [];
    const limit = 200;
    let offset = 0;

    while (true) {
        const result =
            await listSalesStockReconciliation({
                ...filters,
                limit,
                offset,
            });

        const pageRows =
            Array.isArray(result.rows)
                ? result.rows
                : [];

        rows.push(
            ...pageRows.map(
                ({ total_rows, ...row }) => row,
            ),
        );

        offset += pageRows.length;

        if (
            pageRows.length === 0 ||
            offset >= Number(result.total || 0)
        ) {
            break;
        }
    }

    return rows;
}

function reportFilename(extension) {
    return `conciliacao-entradas-saidas-${new Date().toISOString().slice(0, 10)}.${extension}`;
}

function sendExportError(
    res,
    error,
    source,
    message,
) {
    console.error(
        `[conciliationSalesxStock][${source}]`,
        error,
    );

    return res.status(500).json({
        ok: false,
        message,
        detail:
            error?.message ||
            String(error),
    });
}

export async function getConciliationSalesxStock(
    req,
    res,
) {
    try {
        const filters = parseFilters(req.query);

        const [result, summary] = await Promise.all([
            listSalesStockReconciliation(filters),
            getSalesStockSummary(filters),
        ]);

        return res.status(200).json({
            ok: true,
            filters,
            ...result,
            summary,
        });
    } catch (error) {
        console.error(
            '[conciliationSalesxStock][get]',
            error,
        );

        return res.status(500).json({
            ok: false,
            message: 'Erro ao conciliar vendas e estoque.',
            detail:
                error?.message ||
                String(error),
        });
    }
}

export async function exportConciliationSalesxStockPdf(
    req,
    res,
) {
    try {
        const filters = exportFilters(req.query);

        const [rows, summary] = await Promise.all([
            loadAllRows(filters),
            getSalesStockSummary(filters),
        ]);

        const buffer =
            await generateConciliationSalesxStockPdf({
                rows,
                summary,
                filters,
            });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${reportFilename('pdf')}"`,
        );
        res.setHeader('Content-Length', buffer.length);

        return res.status(200).send(buffer);
    } catch (error) {
        return sendExportError(
            res,
            error,
            'export-pdf',
            'Erro ao exportar a conciliação em PDF.',
        );
    }
}

export async function exportConciliationSalesxStockExcel(
    req,
    res,
) {
    try {
        const filters = exportFilters(req.query);

        const [rows, summary] = await Promise.all([
            loadAllRows(filters),
            getSalesStockSummary(filters),
        ]);

        const buffer =
            await generateConciliationSalesxStockExcel({
                rows,
                summary,
                filters,
            });

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );

        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${reportFilename('xlsx')}"`,
        );

        res.setHeader('Content-Length', buffer.length);

        return res.status(200).send(buffer);
    } catch (error) {
        return sendExportError(
            res,
            error,
            'export-excel',
            'Erro ao exportar a conciliação em Excel.',
        );
    }
}

export default {
    getConciliationSalesxStock,
    exportConciliationSalesxStockPdf,
    exportConciliationSalesxStockExcel,
};
