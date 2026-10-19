// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productFiscalCostRulesController.js — Regras de custo fiscal        ║
// ║ CONSART ERP — ESM                                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
    getById,
    getByClassification,
    getByProfile,
    getByProduct,
    create,
    update,
    remove,
    resolve as resolveFiscalCostRuleApi,
    generateProductRule,
} from '../repositories/productFiscalCostRules/productFiscalCostRules.index.js';

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

function payloadWithRequestUser(req) {
    const payload = { ...(req.body || {}) };
    const userId = currentUserId(req);

    if (
        !Object.prototype.hasOwnProperty.call(payload, 'user_id') &&
        userId != null
    ) {
        payload.user_id = userId;
    }

    return payload;
}

function errorStatus(error, fallback = 500) {
    const explicit = Number(error?.status ?? error?.statusCode);

    if (Number.isInteger(explicit) && explicit >= 400 && explicit <= 599) {
        return explicit;
    }

    const message = clean(error?.message).toLowerCase();

    if (
        message.includes('obrigatório') ||
        message.includes('obrigatoria') ||
        message.includes('obrigatório') ||
        message.includes('inválido') ||
        message.includes('invalido') ||
        message.includes('informe ') ||
        message.includes('deve ')
    ) {
        return 400;
    }

    if (error?.code === '23503') return 409;
    if (error?.code === '23505') return 409;
    if (error?.code === '23514') return 400;

    return fallback;
}

function sendError(res, error, context, fallbackStatus = 500) {
    console.error(`[productFiscalCostRulesController:${context}]`, error);

    return res.status(errorStatus(error, fallbackStatus)).json({
        ok: false,
        error: error?.message || 'Erro interno ao processar regra de custo fiscal.',
        code: error?.code || null,
    });
}

// GET /api/product-fiscal-cost-rules/:id
export async function getProductFiscalCostRuleById(req, res) {
    try {
        const ruleId = positiveInteger(req.params.id);

        if (!ruleId) {
            return res.status(400).json({ ok: false, error: 'ID da regra inválido.' });
        }

        const row = await getById(ruleId);

        if (!row) {
            return res.status(404).json({ ok: false, error: 'Regra fiscal não encontrada.' });
        }

        return res.status(200).json({ ok: true, row, data: row });
    } catch (error) {
        return sendError(res, error, 'getById');
    }
}

// GET /api/product-fiscal-cost-rules/product/:productCode
export async function getProductFiscalCostRulesByProduct(req, res) {
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

// GET /api/product-fiscal-cost-rules/classification/:classificationId
export async function getProductFiscalCostRulesByClassification(req, res) {
    try {
        const classificationId = positiveInteger(req.params.classificationId);

        if (!classificationId) {
            return res.status(400).json({
                ok: false,
                error: 'fiscal_classification_id inválido.',
            });
        }

        const rows = await getByClassification(classificationId);
        return res.status(200).json({ ok: true, rows, data: rows });
    } catch (error) {
        return sendError(res, error, 'getByClassification');
    }
}

// GET /api/product-fiscal-cost-rules/profile/:fiscalProfileId
export async function getProductFiscalCostRulesByProfile(req, res) {
    try {
        const fiscalProfileId = positiveInteger(req.params.fiscalProfileId);

        if (!fiscalProfileId) {
            return res.status(400).json({ ok: false, error: 'fiscal_profile_id inválido.' });
        }

        const rows = await getByProfile(fiscalProfileId);
        return res.status(200).json({ ok: true, rows, data: rows });
    } catch (error) {
        return sendError(res, error, 'getByProfile');
    }
}

// GET /api/product-fiscal-cost-rules/resolve/:productCode
export async function resolveProductFiscalCostRule(req, res) {
    try {
        const productCode = clean(req.params.productCode);

        if (!productCode) {
            return res.status(400).json({ ok: false, error: 'productCode é obrigatório.' });
        }

        const row = await resolveFiscalCostRuleApi(productCode);

        // Ausência de regra é um resultado válido: o frontend poderá chamar generate.
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

// POST /api/product-fiscal-cost-rules
export async function createProductFiscalCostRule(req, res) {
    try {
        const payload = payloadWithRequestUser(req);

        const row = await create(payload);
        return res.status(201).json({ ok: true, row, data: row });
    } catch (error) {
        return sendError(res, error, 'create', 400);
    }
}

// PUT/PATCH /api/product-fiscal-cost-rules/:id
export async function updateProductFiscalCostRule(req, res) {
    try {
        const ruleId = positiveInteger(req.params.id);

        if (!ruleId) {
            return res.status(400).json({ ok: false, error: 'ID da regra inválido.' });
        }

        const payload = payloadWithRequestUser(req);

        const row = await update(ruleId, payload);

        if (!row) {
            return res.status(404).json({ ok: false, error: 'Regra fiscal não encontrada.' });
        }

        return res.status(200).json({ ok: true, row, data: row });
    } catch (error) {
        return sendError(res, error, 'update', 400);
    }
}

// DELETE /api/product-fiscal-cost-rules/:id (soft delete)
export async function deleteProductFiscalCostRule(req, res) {
    try {
        const ruleId = positiveInteger(req.params.id);

        if (!ruleId) {
            return res.status(400).json({ ok: false, error: 'ID da regra inválido.' });
        }

        const row = await remove(ruleId);

        if (!row) {
            return res.status(404).json({ ok: false, error: 'Regra fiscal não encontrada.' });
        }

        return res.status(200).json({ ok: true, row, data: row });
    } catch (error) {
        return sendError(res, error, 'delete');
    }
}

// POST /api/product-fiscal-cost-rules/generate/:productCode
export async function generateProductFiscalCostRule(req, res) {
    try {
        const productCode = clean(req.params.productCode);

        if (!productCode) {
            return res.status(400).json({ ok: false, error: 'productCode é obrigatório.' });
        }

        const options = payloadWithRequestUser(req);

        const result = await generateProductRule(productCode, options);

        return res.status(result?.created ? 201 : 200).json({
            ok: true,
            ...result,
            data: result,
        });
    } catch (error) {
        return sendError(res, error, 'generate', 400);
    }
}
