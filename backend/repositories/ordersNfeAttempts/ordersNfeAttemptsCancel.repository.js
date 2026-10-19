// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ordersNfeAttemptsCancel.repository.js — cancelOrderNfe               ║
// ╚══════════════════════════════════════════════════════════════════════╝

import ordersApi from '../orders/orders.index.js';
import tecnospeedNfeApi from '../nfe/nfe.index.js';
import { positiveBigInt } from './ordersNfeAttempts.sanitizers.js';
import { providerDocument } from './ordersNfeAttempts.utils.js';
import { getLatestTrackableByOrderId } from './ordersNfeAttemptsQuery.repository.js';
import { reconcileOrderNfe } from './ordersNfeAttemptsReconcile.repository.js';

export async function cancelOrderNfe({
    orderId,
    justification,
} = {}) {
    const id = positiveBigInt(
        orderId,
        'order_id',
    );

    const normalizedJustification =
        String(justification ?? '').trim();

    if (
        normalizedJustification.length < 15 ||
        normalizedJustification.length > 255
    ) {
        const error = new Error(
            'A justificativa deve possuir entre 15 e 255 caracteres.',
        );

        error.status = 400;
        error.code =
            'INVALID_NFE_CANCELLATION_JUSTIFICATION';

        throw error;
    }

    const order = await ordersApi.getById(id);

    if (!order?.ok) {
        const error = new Error(
            'Pedido não encontrado.',
        );

        error.status = 404;
        error.code = 'ORDER_NOT_FOUND';

        throw error;
    }

    const attempt =
        await getLatestTrackableByOrderId(
            id,
            {
                includeItems: false,
            },
        );

    if (!attempt) {
        const error = new Error(
            'Nenhuma NF-e foi encontrada para o pedido.',
        );

        error.status = 404;
        error.code =
            'ORDER_NFE_ATTEMPT_NOT_FOUND';

        throw error;
    }

    const storedDocument = providerDocument({
        data: attempt.provider_response,
    });

    const providerId = [
        attempt.provider_id,
        storedDocument?.id,
        attempt.access_key,
        storedDocument?.chave,
        storedDocument?.chaveAcesso,
        attempt.integration_id,
        storedDocument?.idIntegracao,
    ].find(
        (value) =>
            String(value ?? '').trim(),
    ) ?? null;

    if (!providerId) {
        const error = new Error(
            'A NF-e do pedido não possui identificador no provedor.',
        );

        error.status = 404;
        error.code =
            'ORDER_NFE_PROVIDER_ID_NOT_FOUND';

        throw error;
    }

    let cancellationResponse;

    try {
        cancellationResponse =
            await tecnospeedNfeApi.cancelarNFe(
                providerId,
                normalizedJustification,
            );
    } catch (error) {
        /*
         * If PlugNotas reports that the NF-e is already cancelled,
         * continue with local reconciliation. This makes cancellation
         * idempotent and permits stock recovery after an interrupted sync.
         */
        const text = String(
            error?.message ??
            error?.response?.data?.message ??
            '',
        ).toUpperCase();

        const alreadyCancelled =
            text.includes('JÁ ESTÁ CANCELADA') ||
            text.includes('JA ESTA CANCELADA') ||
            text.includes('ALREADY CANCELLED') ||
            text.includes('ALREADY CANCELED');

        if (!alreadyCancelled) {
            throw error;
        }

        cancellationResponse = {
            ok: true,
            status: 200,
            cancelled: true,
            alreadyCancelled: true,
            message:
                'A NF-e já estava cancelada no provedor.',
        };
    }

    /*
     * Some provider adapters return { ok: false } instead of throwing.
     * Treat “already cancelled” as success and continue reconciliation.
     */
    if (!cancellationResponse?.ok) {
        const responseText = String(
            cancellationResponse?.message ??
            cancellationResponse?.error?.message ??
            cancellationResponse?.error ??
            '',
        ).toUpperCase();

        const alreadyCancelled =
            responseText.includes('JÁ ESTÁ CANCELADA') ||
            responseText.includes('JA ESTA CANCELADA') ||
            responseText.includes('ALREADY CANCELLED') ||
            responseText.includes('ALREADY CANCELED');

        if (!alreadyCancelled) {
            const error = new Error(
                cancellationResponse?.message ??
                cancellationResponse?.error?.message ??
                'Não foi possível cancelar a NF-e.',
            );

            error.status =
                Number(cancellationResponse?.status) ||
                502;

            error.code =
                'ORDER_NFE_CANCELLATION_FAILED';

            error.details =
                cancellationResponse;

            throw error;
        }

        cancellationResponse = {
            ...cancellationResponse,
            ok: true,
            status: 200,
            cancelled: true,
            alreadyCancelled: true,
        };
    }

    /*
     * Always reconcile after provider cancellation. This updates the
     * attempt and invoice and executes rollbackStockFromOrder().
     */
    const reconciliation =
        await reconcileOrderNfe({
            orderId: id,
        });

    return {
        ok: true,
        status: 200,
        cancelled:
            reconciliation?.cancelled === true,

        alreadyCancelled:
            cancellationResponse
                ?.alreadyCancelled === true,

        order_id: id,
        attempt_id:
            reconciliation?.attempt_id ??
            attempt.attempt_id,

        provider:
            cancellationResponse,

        reconciliation,

        stockRollback:
            reconciliation?.stockRollback ??
            null,

        message:
            reconciliation?.message ??
            cancellationResponse?.message ??
            'NF-e cancelada e sincronizada com o pedido.',
    };
}
