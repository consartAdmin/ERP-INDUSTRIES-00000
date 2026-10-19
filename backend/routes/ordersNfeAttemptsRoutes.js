// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ordersNfeAttemptsRoutes.js — NF-e de pedidos e suas tentativas      ║
// ║ CONSART ERP | Express Router | ESM                                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { Router } from 'express';

import * as controller
    from '../controllers/ordersNfeAttemptsController.js';
import { getOrderNfeDetails }
    from '../controllers/ordersController.js';
import { cancelarNfeByOrder }
    from '../controllers/ordersNfeCancelController.js';
import { getOrderDanfe }
    from '../controllers/ordersDanfeController.js';
import tecnospeedNfeApi
    from '../repositories/nfe/nfe.index.js';
import * as ordersNfeAttemptsApi
    from '../repositories/ordersNfeAttempts/ordersNfeAttempts.index.js';
import { queueErrorEmail } from '../errorEmailReporter.js';

const router = Router();

function reportNfeAttemptError(...args) {
    console.error(...args);

    const caught = args.find((value) => value instanceof Error);
    const label = typeof args[0] === 'string'
        ? args[0]
        : 'Erro nas rotas de tentativas de NF-e de pedidos';

    queueErrorEmail('ORDERS_NFE_ATTEMPTS_ROUTES_ERROR', {
        module: 'routes/ordersNfeAttemptsRoutes.js',
        message: caught?.message || label,
        context: label,
        err: caught
            ? {
                name: caught.name,
                message: caught.message,
                code: caught.code,
                stack: caught.stack,
            }
            : undefined,
        details: args,
    });
}

function firstProviderDocument(providerResponse) {
    if (!providerResponse) return null;
    if (Array.isArray(providerResponse)) return providerResponse[0] ?? null;

    const documents = providerResponse.documents ??
        providerResponse.documentos;

    if (Array.isArray(documents)) return documents[0] ?? null;
    if (documents && typeof documents === 'object') return documents;
    if (providerResponse.id || providerResponse.idIntegracao) {
        return providerResponse;
    }

    return null;
}

// ----------------------------------------------------------------------
// Operações de NF-e vinculadas ao pedido
// ----------------------------------------------------------------------

router.post('/orders/:orderId/issue', async (req, res) => {
    try {
        const result = await ordersNfeAttemptsApi.issueOrderNfe({
            orderId: req.params.orderId,
            userId: req.user?.user_id ?? req.user?.id ?? null,
        });

        return res
            .status(result?.status ?? (result?.pending ? 202 : 200))
            .json(result);
    } catch (error) {
        reportNfeAttemptError(
            '[ordersNfeAttemptsRoutes] Erro ao emitir NF-e:',
            error,
        );

        return res.status(error?.status ?? 500).json({
            ok: false,
            pending: false,
            authorized: false,
            rejected: false,
            error: error?.code ?? 'ORDER_NFE_ISSUE_ERROR',
            message: error?.message ?? 'Erro interno ao emitir NF-e.',
            attempt_id: error?.attempt_id ?? null,
        });
    }
});

router.get('/orders/:orderId/status', async (req, res) => {
    try {
        const result = await ordersNfeAttemptsApi.reconcileOrderNfe({
            orderId: req.params.orderId,
        });

        return res
            .status(result?.status ?? (result?.pending ? 202 : 200))
            .json(result);
    } catch (error) {
        reportNfeAttemptError(
            '[ordersNfeAttemptsRoutes] Erro ao consultar NF-e:',
            error,
        );

        return res.status(error?.status ?? 500).json({
            ok: false,
            pending: false,
            authorized: false,
            rejected: false,
            error: error?.code ?? 'ORDER_NFE_RECONCILE_ERROR',
            message: error?.message ?? 'Erro interno ao consultar NF-e.',
            attempt_id: error?.attempt_id ?? null,
        });
    }
});

router.get('/orders/:id/details', getOrderNfeDetails);
router.post('/orders/:orderId/cancel', cancelarNfeByOrder);
router.get('/orders/:id/danfe', getOrderDanfe);

router.get('/orders/:orderId/xml-debug', async (req, res) => {
    try {
        const attempt = await ordersNfeAttemptsApi.getLatestTrackableByOrderId(
            req.params.orderId,
            { includeItems: false },
        );

        if (!attempt) {
            return res.status(404).json({
                ok: false,
                error: 'SEM_TENTATIVA_NFE_RASTREAVEL',
                message: 'Pedido sem tentativa de NF-e consultável.',
            });
        }

        const storedDocument = firstProviderDocument(
            attempt.provider_response,
        );

        const providerIdentifier = [
            attempt.provider_id,
            attempt.access_key,
            attempt.integration_id,
            storedDocument?.id,
            storedDocument?.chave,
            storedDocument?.chaveAcesso,
            storedDocument?.idIntegracao,
        ].find((value) => String(value ?? '').trim()) ?? null;

        if (!providerIdentifier) {
            return res.status(404).json({
                ok: false,
                error: 'SEM_IDENTIFICADOR_NFE',
                message: 'Tentativa sem identificador TecnoSpeed/PlugNotas.',
                attempt_id: attempt.attempt_id,
            });
        }

        const result = await tecnospeedNfeApi.obterXml(
            providerIdentifier,
        );

        if (!result?.ok) {
            return res.status(result?.status || 400).json({
                ok: false,
                message: 'Não foi possível obter o XML da NF-e.',
                error: result?.error || result,
                attempt_id: attempt.attempt_id,
            });
        }

        res.type('application/xml');
        return res.send(result.xml);
    } catch (error) {
        reportNfeAttemptError(
            '[ordersNfeAttemptsRoutes.xmlDebug] ERR:',
            error,
        );

        return res.status(error?.status ?? 500).json({
            ok: false,
            error: error?.code ?? 'ORDER_NFE_XML_DEBUG_ERROR',
            message: error?.message || String(error),
        });
    }
});

// ----------------------------------------------------------------------
// CRUD e histórico das tentativas
// Rotas específicas devem permanecer antes de /:attemptId.
// ----------------------------------------------------------------------

router.get('/order/:orderId/latest', controller.getLatestByOrderId);
router.get('/', controller.list);
router.post('/', controller.create);

router.get('/:attemptId', controller.getById);
router.patch('/:attemptId', controller.update);
router.post('/:attemptId/items', controller.addItems);
router.put('/:attemptId/items', controller.replaceItems);
router.patch('/:attemptId/authorized', controller.markAuthorized);
router.patch('/:attemptId/rejected', controller.markRejected);
router.patch('/:attemptId/checked', controller.markChecked);
router.patch('/:attemptId/invoice', controller.attachInvoice);

export default router;
