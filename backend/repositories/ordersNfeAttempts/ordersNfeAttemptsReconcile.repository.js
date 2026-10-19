// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ordersNfeAttemptsReconcile.repository.js — reconcileOrderNfe         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import ordersApi from '../orders/orders.index.js';
import tecnospeedNfeApi from '../nfe/nfe.index.js';
import invoicesIssuedApi from '../invoicesIssued/invoicesIssued.index.js';
import nfeAsaasSyncApi from '../nfeAsaasSync/nfeAsaasSync.index.js';
import * as stockFromOrdersService from '../../services/stockFromOrdersService.js';
import { NFE_STATUS_ID } from './ordersNfeAttempts.constants.js';
import { positiveBigInt } from './ordersNfeAttempts.sanitizers.js';
import { normalizeProviderDateTime, normalizeEnvironment, normalizeAccessKey, providerDocument, errorPayload, remoteStatus, isAuthorized, isRejected, isCancelled } from './ordersNfeAttempts.utils.js';
import { getLatestTrackableByOrderId } from './ordersNfeAttemptsQuery.repository.js';
import { updateAttempt, markAuthorized, markRejected, markChecked, attachInvoice } from './ordersNfeAttemptsUpdate.repository.js';
import { isNfeApiHomologationDocument } from '../nfeApi/nfeApi.index.js';

export async function reconcileOrderNfe({ orderId } = {}) {
    const id = positiveBigInt(orderId, 'order_id');
    const order = await ordersApi.getById(id);
    if (!order?.ok) {
        const error = new Error('Pedido não encontrado.');
        error.status = 404;
        throw error;
    }

    const attempt = await getLatestTrackableByOrderId(
        id,
        { includeItems: false },
    );
    const attemptId = attempt?.attempt_id ?? null;
    const storedDocument = providerDocument({
        data: attempt?.provider_response,
    });
    const idConsulta = [
        attempt?.provider_id,
        attempt?.access_key,
        attempt?.integration_id,
        storedDocument?.id,
        storedDocument?.chave,
        storedDocument?.chaveAcesso,
        storedDocument?.idIntegracao,
    ].find((value) => String(value ?? '').trim()) ?? null;
    if (!idConsulta) {
        return { ok: false, status: 404, error: 'SEM_IDENTIFICADOR_NFE', attempt_id: attemptId };
    }

    const response = await tecnospeedNfeApi.consultarNFe(idConsulta);

    if (!response?.ok) {
        if (attemptId) {
            const temporary = [502, 503, 504].includes(Number(response?.status));
            await updateAttempt(attemptId, {
                nfe_status_id: temporary ? NFE_STATUS_ID.PROCESSING : NFE_STATUS_ID.ERROR,
                provider_response: errorPayload(response?.error ?? response),
                error_code: String(response?.status ?? ''),
                error_message: temporary ? null : 'Falha ao consultar NF-e na TecnoSpeed.',
                last_checked_at: new Date(),
            });
        }
        return { ...response, attempt_id: attemptId };
    }

    const data = Array.isArray(response.data) ? response.data[0] ?? {} : response.data ?? {};
    const status = remoteStatus(data);
    const authorized = isAuthorized(status);
    const rejected = isRejected(status);
    const cancelled = isCancelled(status);
    const denied =
        status === 'DENEGADA' ||
        status === 'DENEGADO';
    const cStat = data.cStat ?? data.cstat ?? data.codigoStatus ?? data.codigoRetorno ?? null;
    const message = data.mensagem ?? data.message ?? data.xMotivo ?? data.motivo ?? null;

    const environment = normalizeEnvironment(
        data.ambiente ?? data.environment ?? attempt?.nfe_environment,
    );

    if (attemptId) {
        const common = {
            provider_id: data.id ?? attempt.provider_id ?? null,
            integration_id: data.idIntegracao ?? attempt.integration_id ?? null,
            provider_response: data,
            protocol: data.protocolo ?? data.numeroProtocolo ?? null,
            nfe_number:
                data.numero ?? data.numeroNfe ?? attempt.nfe_number ?? null,
            nfe_series: data.serie ?? attempt.nfe_series ?? null,
            nfe_environment: environment,
            access_key: normalizeAccessKey(
                data.chave ?? data.chaveAcesso ?? data.chaveNfe,
            ) ?? attempt.access_key ?? null,
            generated_xml: data.xml ?? attempt.generated_xml ?? null,
            last_checked_at: new Date(),
        };
        if (authorized) {
            await markAuthorized(attemptId, {
                ...common,
                nfe_status_id:
                    NFE_STATUS_ID.AUTHORIZED,

                authorized_at:
                    normalizeProviderDateTime(data.dataAutorizacao) ??
                    attempt.authorized_at ??
                    new Date(),
            });
        } else if (cancelled) {
            await updateAttempt(attemptId, {
                ...common,

                nfe_status_id:
                    NFE_STATUS_ID.CANCELLED,

                cancelled_at:
                    attempt.cancelled_at ??
                    new Date(),

                error_code: null,
                error_message: null,
            });
        } else if (rejected) {
            await markRejected(attemptId, {
                ...common,

                nfe_status_id:
                    denied
                        ? NFE_STATUS_ID.DENIED
                        : NFE_STATUS_ID.REJECTED,

                error_code:
                    cStat != null
                        ? String(cStat)
                        : null,

                error_message:
                    message ??
                    'NF-e rejeitada.',
            });
        } else {
            await markChecked(attemptId, {
                ...common,
                nfe_status_id:
                    NFE_STATUS_ID.PROCESSING,
            });
        }
    }

    let stockSync = null;
    let stockRollback = null;
    let invoiceSync = null;
    let asaasSync = null;

    // NF-e de testes (homologação) da NF-e API: registra a nota, mas não
    // movimenta estoque nem gera contas a receber/boletos.
    const isTestInvoice = isNfeApiHomologationDocument(data, attempt?.nfe_environment);
    const skipped = { ok: true, skipped: true, reason: 'NF-e de homologação (NF-e API)' };

    if (authorized) {
        invoiceSync = await invoicesIssuedApi.upsertFromOrder(id, {
            attemptId,
        });

        const invoiceId =
            invoiceSync?.invoice_id ??
            invoiceSync?.data?.invoice_id ??
            invoiceSync?.invoice?.invoice_id ??
            null;

        if (attemptId && invoiceId) {
            await attachInvoice(attemptId, invoiceId);
        }

        stockSync = isTestInvoice ? skipped : await stockFromOrdersService.applyStockFromOrder(
            order,
            {
                attemptId,
            },
        );

        asaasSync = isTestInvoice ? skipped : await nfeAsaasSyncApi.syncAuthorizedNfe({
            orderId: id,
            nfeNumber:
                data.numero ??
                data.numeroNfe ??
                attempt?.nfe_number ??
                null,
            nfeKey:
                data.chave ??
                data.chaveAcesso ??
                data.chaveNfe ??
                attempt?.access_key ??
                null,
        });
    }

    if (cancelled) {
        stockRollback = isTestInvoice ? skipped :
            await stockFromOrdersService.rollbackStockFromOrder({
                attemptId,
            });

        invoiceSync = await pool.query(
            `
                UPDATE public."invoicesIssued"
                SET nfe_status_id = $2,
                    nfe_status = 'CANCELADO',
                    cancelled_at = COALESCE(cancelled_at, NOW()),
                    cancellation_reason = COALESCE($3, cancellation_reason),
                    updated_at = NOW()
                WHERE order_id = $1
                RETURNING *
            `,
            [
                id,
                NFE_STATUS_ID.CANCELLED,
                message ?? 'NF-e cancelada no provedor.',
            ],
        );

        invoiceSync = invoiceSync.rows[0] ?? null;
    }

    const finalized = authorized || rejected || cancelled;

    return {
        ok: true,
        status: finalized ? 200 : 202,
        pending: !finalized,
        authorized,
        rejected,
        cancelled,
        attempt_id: attemptId,
        message: message ?? (authorized
            ? 'NF-e autorizada com sucesso.'
            : cancelled
                ? 'NF-e cancelada com sucesso.'
                : rejected
                    ? 'NF-e rejeitada.'
                    : 'NF-e ainda está sendo processada.'),
        stockSync,
        stockRollback,
        invoiceSync,
        asaasSync,
        nfe: { ...data, status },
    };
}
