// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsFiscalOriginsController.js — Origem fiscal do produto        ║
// ║ CONSART ERP — ESM                                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
    getById,
    getByProduct,
    resolveForItem,
    upsertFromFiscalRule,
    remove,
} from '../repositories/productsFiscalOrigins/productsFiscalOrigins.index.js';

function clean(value) {
    if (value == null) return '';
    return String(value).trim();
}

function positiveInteger(value) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : null;
}

function currentUserId(req) {
    return (
        positiveInteger(req?.user?.user_id) ??
        positiveInteger(req?.user?.userId) ??
        positiveInteger(req?.user?.id) ??
        null
    );
}

function errorStatus(error, fallback = 500) {
    const explicit = Number(error?.status ?? error?.statusCode);

    if (Number.isInteger(explicit) && explicit >= 400 && explicit <= 599) {
        return explicit;
    }

    const message = clean(error?.message).toLowerCase();

    if (
        message.includes('obrigatório') ||
        message.includes('inválido') ||
        message.includes('invalido') ||
        message.includes('informe ') ||
        message.includes('nenhuma regra')
    ) {
        return 400;
    }

    if (error?.code === '23503') return 409;
    if (error?.code === '23505') return 409;
    if (error?.code === '23514') return 400;

    return fallback;
}

function sendError(res, error, context, fallbackStatus = 500) {
    console.error(`[productsFiscalOriginsController:${context}]`, error);

    return res.status(errorStatus(error, fallbackStatus)).json({
        ok: false,
        error: error?.message || 'Erro interno ao processar a origem fiscal.',
        code: error?.code || null,
    });
}

// GET /api/products-fiscal-origins/product/:productCode
export async function getProductsFiscalOriginsByProduct(req, res) {
    try {
        const productCode = clean(req.params.productCode);

        if (!productCode) {
            return res.status(400).json({ ok: false, error: 'productCode é obrigatório.' });
        }

        const rows = await getByProduct(productCode);
        return res.status(200).json({ ok: true, rows, data: rows });
    } catch (error) {
        return sendError(res, error, 'getByProduct');
    }
}

// GET /api/products-fiscal-origins/resolve/:productCode?lotId=&productGradeId=
export async function resolveProductsFiscalOrigin(req, res) {
    try {
        const productCode = clean(req.params.productCode);

        if (!productCode) {
            return res.status(400).json({ ok: false, error: 'productCode é obrigatório.' });
        }

        const row = await resolveForItem({
            productCode,
            lotId: positiveInteger(req.query.lotId ?? req.query.lot_id),
            productGradeId: positiveInteger(
                req.query.productGradeId ?? req.query.product_grade_id,
            ),
        });

        // Ausência de origem é um resultado válido.
        return res.status(200).json({
            ok: true,
            found: Boolean(row),
            row: row || null,
            data: row || null,
        });
    } catch (error) {
        return sendError(res, error, 'resolve');
    }
}

// POST /api/products-fiscal-origins/apply/:productCode
//
// Calcula pela regra fiscal do produto (productsFiscalV2) e grava.
// Body: { lotId?, productGradeId?, productId?, unit?, unitCost?, notes? }
export async function applyProductsFiscalOrigin(req, res) {
    try {
        const productCode = clean(req.params.productCode);

        if (!productCode) {
            return res.status(400).json({ ok: false, error: 'productCode é obrigatório.' });
        }

        const body = req.body || {};

        const result = await upsertFromFiscalRule({
            productCode,
            lotId: positiveInteger(body.lotId ?? body.lot_id),
            productGradeId: positiveInteger(
                body.productGradeId ?? body.product_grade_id,
            ),
            productId: positiveInteger(body.productId ?? body.product_id),
            unit: clean(body.unit) || null,
            unitCost: body.unitCost ?? body.unit_cost ?? null,
            notes: clean(body.notes) || null,
            userId: currentUserId(req),
        });

        return res.status(200).json({
            ok: true,
            ...result,
            data: result.row,
        });
    } catch (error) {
        return sendError(res, error, 'apply', 400);
    }
}

// GET /api/products-fiscal-origins/:id
export async function getProductsFiscalOriginById(req, res) {
    try {
        const id = positiveInteger(req.params.id);

        if (!id) {
            return res.status(400).json({ ok: false, error: 'ID da origem fiscal inválido.' });
        }

        const row = await getById(id);

        if (!row) {
            return res.status(404).json({ ok: false, error: 'Origem fiscal não encontrada.' });
        }

        return res.status(200).json({ ok: true, row, data: row });
    } catch (error) {
        return sendError(res, error, 'getById');
    }
}

// DELETE /api/products-fiscal-origins/:id (soft delete)
export async function deleteProductsFiscalOrigin(req, res) {
    try {
        const id = positiveInteger(req.params.id);

        if (!id) {
            return res.status(400).json({ ok: false, error: 'ID da origem fiscal inválido.' });
        }

        const row = await remove(id);

        if (!row) {
            return res.status(404).json({ ok: false, error: 'Origem fiscal não encontrada.' });
        }

        return res.status(200).json({ ok: true, row, data: row });
    } catch (error) {
        return sendError(res, error, 'delete');
    }
}
