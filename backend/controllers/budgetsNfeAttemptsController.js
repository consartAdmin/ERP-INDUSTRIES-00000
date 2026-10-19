/* ╔══════════════════════════════════════════════════════════════════════╗
 * ║ budgetsNfeAttemptsController.js — HTTP controller                    ║
 * ╚══════════════════════════════════════════════════════════════════════╝ */

'use strict';

import budgetsNfeAttemptsApi from '../repositories/budgetsNfeAttempts/budgetsNfeAttempts.index.js';

function parseBoolean(value) {
    if (value === undefined) return undefined;
    return ['1', 'true', 't', 'yes', 'sim'].includes(String(value).trim().toLowerCase());
}

function sendError(res, error) {
    const status = Number(error?.status || error?.statusCode || 500);
    return res.status(status).json({
        ok: false,
        code: error?.code || 'BUDGET_NFE_ATTEMPT_ERROR',
        message: error?.message || 'Erro interno ao processar a tentativa de NF-e.',
    });
}

export async function listBudgetNfeAttempts(req, res) {
    try {
        const result = await budgetsNfeAttemptsApi.list({
            ...req.query,
            is_final: parseBoolean(req.query.is_final),
            is_authorized: parseBoolean(req.query.is_authorized),
        });
        return res.json({ ok: true, ...result });
    } catch (error) {
        return sendError(res, error);
    }
}

export async function listBudgetNfeAttemptsByBudget(req, res) {
    try {
        const result = await budgetsNfeAttemptsApi.listByBudget(req.params.budgetId);
        return res.json({ ok: true, ...result });
    } catch (error) {
        return sendError(res, error);
    }
}

export async function getBudgetNfeAttempt(req, res) {
    try {
        const row = await budgetsNfeAttemptsApi.getById(req.params.attemptId);
        if (!row) return res.status(404).json({ ok: false, code: 'ATTEMPT_NOT_FOUND', message: 'Tentativa de NF-e não encontrada.' });
        return res.json({ ok: true, row });
    } catch (error) {
        return sendError(res, error);
    }
}

export async function createBudgetNfeAttempt(req, res) {
    try {
        const row = await budgetsNfeAttemptsApi.create(req.body || {}, {
            userId: req.user?.user_id ?? req.user?.id ?? null,
        });
        return res.status(201).json({ ok: true, message: 'Tentativa de NF-e registrada.', row });
    } catch (error) {
        return sendError(res, error);
    }
}

export async function updateBudgetNfeAttempt(req, res) {
    try {
        const row = await budgetsNfeAttemptsApi.update(req.params.attemptId, req.body || {});
        return res.json({ ok: true, message: 'Tentativa atualizada.', row });
    } catch (error) {
        return sendError(res, error);
    }
}

export async function updateBudgetNfeAttemptStatus(req, res) {
    try {
        const row = await budgetsNfeAttemptsApi.setStatus(req.params.attemptId, req.body || {}, {
            userId: req.user?.user_id ?? req.user?.id ?? null,
        });
        return res.json({ ok: true, message: 'Status da tentativa atualizado.', row });
    } catch (error) {
        return sendError(res, error);
    }
}

export async function linkBudgetNfeAttemptInvoice(req, res) {
    try {
        const row = await budgetsNfeAttemptsApi.linkInvoice(
            req.params.attemptId,
            req.body?.invoice_id,
        );
        return res.json({ ok: true, message: 'NF-e vinculada à tentativa.', row });
    } catch (error) {
        return sendError(res, error);
    }
}

export async function deleteBudgetNfeAttempt(req, res) {
    try {
        const result = await budgetsNfeAttemptsApi.remove(req.params.attemptId);
        return res.json({ ok: true, message: 'Tentativa removida.', ...result });
    } catch (error) {
        return sendError(res, error);
    }
}
