// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ordersNfeAttemptsIssue.repository.js — Emissão da NF-e do pedido     ║
// ║ reserveNfeNumberForAttempt / issueOrderNfe                           ║
// ╚══════════════════════════════════════════════════════════════════════╝

import ordersApi from '../orders/orders.index.js';
import tecnospeedNfeApi from '../nfe/nfe.index.js';
import { ORDERS_NFE_ATTEMPTS_TABLE } from './ordersNfeAttempts.catalog.js';
import { NFE_STATUS_ID } from './ordersNfeAttempts.constants.js';
import { positiveBigInt } from './ordersNfeAttempts.sanitizers.js';
import { saoPauloDate, numberOrZero, normalizeEnvironment, providerDocument, errorPayload, snapshotItems } from './ordersNfeAttempts.utils.js';
import { transaction, createAttempt, replaceItems } from './ordersNfeAttemptsCreate.repository.js';
import { updateAttempt } from './ordersNfeAttemptsUpdate.repository.js';
import { routeProvider, resolveBudgetIssueTarget } from '../nfeApi/nfeApi.index.js';

// Pedidos: NFE_PROVIDER=nfe-api emite pela NF-e API própria; senão, TecnoSpeed.
const emitirNFe = routeProvider('emitirNFe', (...args) => tecnospeedNfeApi.emitirNFe(...args));

// Homologação pela NF-e API: o builder exige um número (senão reserva um da
// sequência real), então recebe este marcador, que é removido antes do envio.
const API_NUMBERING_PLACEHOLDER = 999999999;

export async function reserveNfeNumberForAttempt(attemptId) {
    const id = positiveBigInt(attemptId, 'attempt_id');

    return transaction(async (client) => {
        const attemptResult = await client.query(
            `
            SELECT attempt_id, order_id, nfe_number
            FROM ${ORDERS_NFE_ATTEMPTS_TABLE}
            WHERE attempt_id = $1
            FOR UPDATE
            `,
            [id],
        );

        if (attemptResult.rowCount === 0) {
            const error = new Error(
                `Tentativa ${id} não encontrada para reservar o número da NF-e.`,
            );
            error.status = 404;
            error.code = 'ORDER_NFE_ATTEMPT_NOT_FOUND';
            throw error;
        }

        const attempt = attemptResult.rows[0];
        const existingNumber = Number(attempt.nfe_number);

        // Reutiliza o número da própria tentativa.
        if (
            Number.isSafeInteger(existingNumber) &&
            existingNumber > 0
        ) {
            return existingNumber;
        }

        let sequenceResult = await client.query(
            `
            SELECT id, sequence_number
            FROM public.nfe
            WHERE is_active = TRUE
            ORDER BY id ASC
            LIMIT 1
            FOR UPDATE
            `,
        );

        if (sequenceResult.rowCount === 0) {
            sequenceResult = await client.query(
                `
                INSERT INTO public.nfe (
                    sequence_number,
                    is_active
                )
                VALUES (0, TRUE)
                RETURNING id, sequence_number
                `,
            );
        }

        const sequenceId = sequenceResult.rows[0].id;

        const numberResult = await client.query(
            `
            UPDATE public.nfe
            SET sequence_number = sequence_number + 1,
                updated_at = NOW()
            WHERE id = $1
            RETURNING sequence_number
            `,
            [sequenceId],
        );

        const nfeNumber = Number(
            numberResult.rows[0]?.sequence_number,
        );

        if (
            !Number.isSafeInteger(nfeNumber) ||
            nfeNumber <= 0
        ) {
            const error = new Error(
                'Não foi possível reservar o número da NF-e.',
            );
            error.status = 500;
            error.code = 'ORDER_NFE_NUMBER_RESERVATION_FAILED';
            throw error;
        }

        await client.query(
            `
            UPDATE ${ORDERS_NFE_ATTEMPTS_TABLE}
            SET nfe_number = $1,
                updated_at = NOW()
            WHERE attempt_id = $2
            `,
            [nfeNumber, id],
        );

        console.log(
            `[ordersNfeAttemptsApi] Tentativa ${id} reservou NF-e nº ${nfeNumber}.`,
        );

        return nfeNumber;
    });
}

export async function issueOrderNfe({ orderId, userId = null } = {}) {
    const id = positiveBigInt(orderId, 'order_id');
    const order = await ordersApi.getById(id);
    if (!order?.ok) {
        const error = new Error('Pedido não encontrado ou inválido para emissão de NF-e.');
        error.status = 404;
        throw error;
    }

    const header = order.header ?? {};

    // Ambiente e numeração: TecnoSpeed → NFE_AMBIENTE; NF-e API → painel /admin
    const target = await resolveBudgetIssueTarget();
    let environment = process.env.NFE_ENVIRONMENT ?? null;
    if (target.provider === 'nfe-api') {
        environment = target.environment;
    } else {
        try {
            environment = tecnospeedNfeApi.getEffectiveConfig?.()?.ambiente ?? environment;
        } catch {
            // Usa a configuração já disponível.
        }
    }
    environment = normalizeEnvironment(environment);

    const emissionNow = new Date();
    const canonicalIssueDate = saoPauloDate(emissionNow);

    const attempt = await createAttempt({
        order_id: id,
        budget_id: header.budget_id ?? null,
        nfe_status_id: NFE_STATUS_ID.PENDING,
        nfe_environment: environment,
        operation_type_id: header.operation_type_id ?? null,
        customer_id: header.customer_id ?? null,
        customer_name: header.customer_name ?? header.nome_razao_social ?? null,
        customer_tax_id: header.customer_tax_id ?? header.cnpj_cpf ?? null,
        customer_email: header.customer_email ?? header.email ?? null,
        customer_phone: header.customer_phone ?? header.phone ?? null,
        issue_date: canonicalIssueDate,
        subtotal: numberOrZero(header.subtotal),
        discount_total: numberOrZero(header.total_discount),
        freight_value: numberOrZero(header.freight_value),
        total_amount: numberOrZero(header.total_amount),
        requested_by: userId,
    }, snapshotItems(order));

    const attemptId = attempt.attempt_id;

    try {
        // Homologação pela NF-e API: a API numera e public.nfe não é consumida
        const reservedNumber = target.apiNumbering
            ? null
            : await reserveNfeNumberForAttempt(
                attemptId,
            );

        // Passa o número reservado para o gerador do payload.
        order.header = {
            ...order.header,
            nfe_number: reservedNumber ?? API_NUMBERING_PLACEHOLDER,
        };

        const payload = await tecnospeedNfeApi.buildNFeFromOrder(
            order,
        );

        if (target.apiNumbering) {
            // O marcador não pode chegar à nota
            delete payload.numero;
            if (payload.cobranca) delete payload.cobranca.numero;
            if (payload.informacoesComplementares) {
                payload.informacoesComplementares = String(payload.informacoesComplementares)
                    .replace(new RegExp(`\\s*\\|?\\s*Fatura:\\s*${API_NUMBERING_PLACEHOLDER}`, 'g'), '')
                    .trim();
            }
        }

        await updateAttempt(attemptId, {
            nfe_number: reservedNumber,
            request_payload: payload,
        });

        await replaceItems(attemptId, snapshotItems(order, payload));

        const response = await emitirNFe(payload);
        if (!response?.ok) {
            await updateAttempt(attemptId, {
                nfe_status_id: NFE_STATUS_ID.ERROR,
                provider_response: errorPayload(response?.error ?? response),
                error_code: String(response?.status ?? response?.error?.code ?? ''),
                error_message:
                    response?.error?.message ?? response?.data?.message ?? 'Falha ao emitir NF-e.',
                rejected_at: new Date(),
                last_checked_at: new Date(),
            });
            return { ...response, attempt_id: attemptId };
        }

        const document = providerDocument(response);
        await updateAttempt(attemptId, {
            // Homologação pela NF-e API: o número vem da API
            ...(target.apiNumbering && document?.numero ? { nfe_number: Number(document.numero) } : {}),
            nfe_status_id: NFE_STATUS_ID.PROCESSING,
            provider_id: document?.id ?? null,
            integration_id: document?.idIntegracao ?? null,
            protocol: response.data?.protocol ?? null,
            provider_response: response.data ?? response,
            error_code: null,
            error_message: null,
            last_checked_at: new Date(),
        });

        return {
            ok: true,
            status: 202,
            pending: true,
            authorized: false,
            rejected: false,
            attempt_id: attemptId,
            message: response.data?.message ?? 'NF-e enviada para processamento.',
            nfe: {
                id: document?.id ?? null,
                idIntegracao: document?.idIntegracao ?? null,
                protocol: response.data?.protocol ?? null,
                status: 'PROCESSANDO',
                ambiente: environment,
            },
        };
    } catch (error) {
        await updateAttempt(attemptId, {
            nfe_status_id: NFE_STATUS_ID.ERROR,
            provider_response: errorPayload(error),
            error_code: error?.code ?? null,
            error_message: error?.message ?? 'Erro interno ao emitir NF-e.',
            rejected_at: new Date(),
            last_checked_at: new Date(),
        });
        error.attempt_id = attemptId;
        throw error;
    }
}
