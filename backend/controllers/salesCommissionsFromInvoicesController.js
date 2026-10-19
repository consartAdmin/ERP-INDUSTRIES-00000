// ╔══════════════════════════════════════════════════════════════════════╗
// ║ salesCommissionsFromInvoicesController.js — NF-e Commissions         ║
// ║ CONSART ERP | ESM                                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
    generateSalesCommissionsFromInvoices,
    recalcSalesCommissionsFromInvoices,
    diagnosticsSalesCommissionsFromInvoices,
    listSalesCommissionsFromInvoices,
    getSalesCommissionsFromInvoicesPdfData,
} from '../repositories/salesCommissionsFromInvoices/salesCommissionsFromInvoices.index.js';

import generateSalesCommissionsFromInvoicesPdf
    from '../generationPdf/generationSalesCommissionsFromInvoicesPdf.js';

import buildSalesCommissionsFromInvoicesWorkbook
    from '../generationPdf/generationSalesCommissionsFromInvoicesExcel.js';

const ok = (res, data = {}) => res.json({ ok: true, ...data });

const bad = (res, message = 'Erro', code = 400, extra = {}) =>
    res.status(code).json({ ok: false, message, ...extra });

const isIsoDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

function toIntOrNull(v) {
    const s = String(v ?? '').trim();

    if (!s) {
        return null;
    }

    const n = Number(s);

    if (!Number.isFinite(n)) {
        return null;
    }

    return Math.trunc(n);
}

/* ======================================================================
   GENERATE
====================================================================== */

export async function generate(req, res) {
    try {
        const dateStart =
            (req.body?.dateStart || '').trim() || null;

        const dateEnd =
            (req.body?.dateEnd || '').trim() || null;

        const forceRegenerate =
            !!req.body?.forceRegenerate;

        const recalcAfter =
            req.body?.recalcAfter !== undefined
                ? !!req.body.recalcAfter
                : true;

        if (dateStart && !isIsoDate(dateStart)) {
            return bad(
                res,
                'dateStart inválido (YYYY-MM-DD)'
            );
        }

        if (dateEnd && !isIsoDate(dateEnd)) {
            return bad(
                res,
                'dateEnd inválido (YYYY-MM-DD)'
            );
        }

        const generated =
            await generateSalesCommissionsFromInvoices({
                dateStart,
                dateEnd,
                forceRegenerate,
            });

        let recalculated = null;

        if (recalcAfter) {
            recalculated =
                await recalcSalesCommissionsFromInvoices({
                    onlyMissing: false,
                });
        }

        return ok(res, {
            generated,
            recalculated,
        });
    } catch (err) {
        console.error('[SCI] generate ERR:', err);

        return bad(
            res,
            'Falha ao gerar comissões pelas NF-e emitidas.',
            500,
            {
                detail: String(err.message || err),
            }
        );
    }
}

/* ======================================================================
   RECALC
====================================================================== */

export async function recalc(req, res) {
    try {
        const onlyMissing =
            req.body?.onlyMissing !== undefined
                ? !!req.body.onlyMissing
                : true;

        const data =
            await recalcSalesCommissionsFromInvoices({
                onlyMissing,
            });

        return ok(res, data);
    } catch (err) {
        console.error('[SCI] recalc ERR:', err);

        return bad(
            res,
            'Falha ao recalcular comissões das NF-e.',
            500,
            {
                detail: String(err.message || err),
            }
        );
    }
}

/* ======================================================================
   DIAGNOSTICS
====================================================================== */

export async function diagnostics(req, res) {
    try {
        const dateStart =
            (req.query.dateStart || '').trim() || null;

        const dateEnd =
            (req.query.dateEnd || '').trim() || null;

        const salesperson =
            (req.query.salesperson || '').trim() || null;

        const priceId =
            toIntOrNull(req.query.priceId);

        const data =
            await diagnosticsSalesCommissionsFromInvoices({
                dateStart,
                dateEnd,
                salesperson,
                priceId:
                    priceId && priceId > 0
                        ? priceId
                        : null,
            });

        return ok(res, data);
    } catch (err) {
        console.error('[SCI] diagnostics ERR:', err);

        return bad(
            res,
            'Falha no diagnóstico das comissões por NF-e.',
            500,
            {
                detail: String(err.message || err),
            }
        );
    }
}

/* ======================================================================
   ITEMS
====================================================================== */

export async function items(req, res) {
    try {
        const dateStart =
            (req.query.dateStart || '').trim() || null;

        const dateEnd =
            (req.query.dateEnd || '').trim() || null;

        const salesperson =
            (req.query.salesperson || '').trim() || null;

        const priceId =
            toIntOrNull(req.query.priceId);

        const limit = Math.max(
            1,
            Math.min(
                5000,
                Number(req.query.limit || 500) || 500
            )
        );

        const offset = Math.max(
            0,
            Number(req.query.offset || 0) || 0
        );

        if (dateStart && !isIsoDate(dateStart)) {
            return bad(
                res,
                'dateStart inválido (YYYY-MM-DD)'
            );
        }

        if (dateEnd && !isIsoDate(dateEnd)) {
            return bad(
                res,
                'dateEnd inválido (YYYY-MM-DD)'
            );
        }

        if (
            req.query.priceId !== undefined &&
            req.query.priceId !== '' &&
            (!priceId || priceId <= 0)
        ) {
            return bad(
                res,
                'priceId inválido (inteiro > 0)'
            );
        }

        const data =
            await listSalesCommissionsFromInvoices({
                dateStart,
                dateEnd,
                salesperson,
                priceId:
                    priceId && priceId > 0
                        ? priceId
                        : null,
                limit,
                offset,
            });

        return ok(res, data);
    } catch (err) {
        console.error('[SCI] items ERR:', err);

        return bad(
            res,
            'Falha ao listar comissões por NF-e.',
            500,
            {
                detail: String(err.message || err),
            }
        );
    }
}

/* ======================================================================
   PDF
====================================================================== */

export async function pdf(req, res) {
    try {
        const dateStart =
            (req.query.dateStart || '').trim() || null;

        const dateEnd =
            (req.query.dateEnd || '').trim() || null;

        const salesperson =
            (req.query.salesperson || '').trim() || null;

        const priceId =
            toIntOrNull(req.query.priceId);

        if (dateStart && !isIsoDate(dateStart)) {
            return bad(
                res,
                'dateStart inválido (YYYY-MM-DD)'
            );
        }

        if (dateEnd && !isIsoDate(dateEnd)) {
            return bad(
                res,
                'dateEnd inválido (YYYY-MM-DD)'
            );
        }

        if (
            req.query.priceId !== undefined &&
            req.query.priceId !== '' &&
            (!priceId || priceId <= 0)
        ) {
            return bad(
                res,
                'priceId inválido (inteiro > 0)'
            );
        }

        const data =
            await getSalesCommissionsFromInvoicesPdfData({
                dateStart,
                dateEnd,
                salesperson,
                priceId:
                    priceId && priceId > 0
                        ? priceId
                        : null,
            });

        const pdfBuffer =
            await generateSalesCommissionsFromInvoicesPdf({
                filters: data.filters,
                diagnostics: data.diagnostics,
                rows: data.rows,
            });

        const filename =
            `sales-commissions-nfe-${Date.now()}.pdf`;

        res.setHeader(
            'Content-Type',
            'application/pdf'
        );

        res.setHeader(
            'Content-Disposition',
            `inline; filename="${filename}"`
        );

        res.setHeader(
            'Content-Length',
            pdfBuffer.length
        );

        return res.end(pdfBuffer);
    } catch (err) {
        console.error('[SCI] pdf ERR:', err);

        return bad(
            res,
            'Falha ao gerar PDF das comissões por NF-e.',
            500,
            {
                detail: String(err.message || err),
            }
        );
    }
}

/* ======================================================================
   EXCEL
====================================================================== */

export async function excel(req, res) {
    try {
        const dateStart = (req.query.dateStart || '').trim() || null;
        const dateEnd = (req.query.dateEnd || '').trim() || null;
        const salesperson = (req.query.salesperson || '').trim() || null;
        const priceId = toIntOrNull(req.query.priceId);

        if (dateStart && !isIsoDate(dateStart)) {
            return bad(res, 'dateStart inválido (YYYY-MM-DD)');
        }

        if (dateEnd && !isIsoDate(dateEnd)) {
            return bad(res, 'dateEnd inválido (YYYY-MM-DD)');
        }

        const data = await getSalesCommissionsFromInvoicesPdfData({
            dateStart,
            dateEnd,
            salesperson,
            priceId: priceId && priceId > 0 ? priceId : null,
        });

        const workbook = await buildSalesCommissionsFromInvoicesWorkbook({
            filters: data.filters,
            diagnostics: data.diagnostics,
            rows: data.rows,
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="comissoes-nfe-${Date.now()}.xlsx"`);

        await workbook.xlsx.write(res);
        return res.end();
    } catch (err) {
        console.error('[SCI] excel ERR:', err);

        return bad(res, 'Falha ao gerar Excel das comissões por NF-e.', 500, {
            detail: String(err.message || err),
        });
    }
}
