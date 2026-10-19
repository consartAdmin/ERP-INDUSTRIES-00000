// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsIssuedsController.js — Endpoints de NF-e de orçamento       ║
// ║ CONSART ERP | Express | Node.js ESM                                ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
    getBudgetNfePreparedData,
    issueBudgetNfe,
    reconcileBudgetNfe,
    getBudgetNfeXml,
    getBudgetNfeDanfe,
} from '../repositories/nfeIssuance/nfeIssuance.index.js';
import { generateBudgetNfePreviewPdf } from '../services/budgetsNfePreviewService.js';

function setNoCache(res) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
}

function sendError(res, error, fallbackCode, fallbackMessage) {
    if (res.headersSent) return res.end();
    return res.status(Number(error?.status) || 500).json({
        ok: false,
        error: error?.code || fallbackCode,
        message: error?.message || fallbackMessage,
        data: error?.details || undefined,
    });
}

export async function getBudgetNfePreviewPdf(req, res) {
    setNoCache(res);
    try {
        const budget = await getBudgetNfePreparedData(req.params.budgetId);
        const { buffer, filename, previewNfeNumber } = await generateBudgetNfePreviewPdf(budget);
        res.status(200);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        res.setHeader('Content-Length', String(buffer.length));
        if (Number.isSafeInteger(Number(previewNfeNumber)) && Number(previewNfeNumber) > 0) {
            res.setHeader('X-NFE-Preview-Number', String(previewNfeNumber));
        }
        return res.end(buffer);
    } catch (error) {
        console.error('[budgetsIssuedsController][preview]', error);
        return sendError(res, error, 'BUDGET_NFE_PREVIEW_FAILED', 'Não foi possível gerar a pré-visualização da NF-e.');
    }
}

export async function issueBudgetNfeController(req, res) {
    setNoCache(res);
    try {
        if (req.body?.confirm !== true) {
            return res.status(400).json({ ok: false, error: 'ISSUE_CONFIRMATION_REQUIRED', message: 'Confirme explicitamente a emissão da NF-e.' });
        }
        const result = await issueBudgetNfe(req.params.budgetId, {
            userId: req.user?.user_id || req.user?.id || null,
        });

        // NF-e já autorizada na resposta (NF-e API é síncrona): reconcilia agora.
        // Sem isso, invoicesIssued, estoque, status FATURADO e boletos só seriam
        // processados por GET /status, que o front não chama nesse caso.
        if (String(result?.status || '').toUpperCase() === 'AUTORIZADA') {
            try {
                result.reconcile = await reconcileBudgetNfe(req.params.budgetId);
            } catch (error) {
                console.error('[budgetsIssuedsController][issue][reconcile]', error);
                result.reconcile = { ok: false, error: error?.code || 'BUDGET_NFE_RECONCILE_FAILED', message: error?.message };
            }
        }

        return res.status(202).json({
            ok: true,
            message: result.recovered ? 'NF-e localizada no provedor e vinculada ao orçamento.' : 'NF-e enviada para processamento.',
            data: result,
        });
    } catch (error) {
        console.error('[budgetsIssuedsController][issue]', error);
        return sendError(res, error, 'BUDGET_NFE_ISSUE_FAILED', 'Não foi possível emitir a NF-e.');
    }
}

export async function reconcileBudgetNfeController(req, res) {
    setNoCache(res);
    try {
        const result = await reconcileBudgetNfe(req.params.budgetId);
        return res.status(200).json({ ok: true, message: 'Situação da NF-e sincronizada com o provedor.', data: result });
    } catch (error) {
        console.error('[budgetsIssuedsController][status]', error);
        return sendError(res, error, 'BUDGET_NFE_RECONCILE_FAILED', 'Não foi possível consultar a NF-e.');
    }
}

export async function getBudgetNfeXmlController(req, res) {
    setNoCache(res);
    try {
        const { xml } = await getBudgetNfeXml(req.params.budgetId);
        res.status(200);
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="nfe-orcamento-${Number(req.params.budgetId)}.xml"`);
        return res.send(xml);
    } catch (error) {
        console.error('[budgetsIssuedsController][xml]', error);
        return sendError(res, error, 'BUDGET_NFE_XML_FAILED', 'Não foi possível obter o XML da NF-e.');
    }
}

export async function getBudgetNfeDanfeController(req, res) {
    setNoCache(res);
    try {
        const { buffer } = await getBudgetNfeDanfe(req.params.budgetId);
        res.status(200);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="danfe-orcamento-${Number(req.params.budgetId)}.pdf"`);
        res.setHeader('Content-Length', String(buffer.length));
        return res.end(buffer);
    } catch (error) {
        console.error('[budgetsIssuedsController][danfe]', error);
        return sendError(res, error, 'BUDGET_NFE_DANFE_FAILED', 'Não foi possível obter o DANFE da NF-e.');
    }
}

export default {
    getBudgetNfePreviewPdf,
    issueBudgetNfeController,
    reconcileBudgetNfeController,
    getBudgetNfeXmlController,
    getBudgetNfeDanfeController,
};
