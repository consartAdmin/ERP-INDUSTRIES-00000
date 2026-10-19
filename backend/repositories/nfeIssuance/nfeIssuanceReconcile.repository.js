// ╔════════════════════════════════════════════════════╗
// ║ nfeIssuanceReconcile.repository.js — reconciliação ║
// ║ consulta o provedor e atualiza tentativa/orçamento ║
// ╚════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import * as tecnospeedNfeApi from '../nfe/nfe.index.js';
import invoicesIssuedApi from '../../repositories/invoicesIssued/invoicesIssued.index.js';
import {
  syncAuthorizedBudgetNfe,
} from '../../repositories/nfeAsaasSync/nfeAsaasSync.index.js';
import * as stockFromBudgetsService from '../../services/stockFromBudgetsService.js';
import { ATTEMPTS_TABLE } from './nfeIssuance.constants.js';
import { providerDocument, providerProtocolFrom, providerMessageFrom, providerAccessKeyFrom, normalizeProviderStatus, logProviderResult } from './nfeIssuance.provider.js';
import { getBudgetIssuedData } from './nfeIssuanceFiscalContext.repository.js';
import { resolveNfeStatus } from './nfeIssuanceAttempts.repository.js';
import { getBudgetNfeReference, resolveProviderId } from './nfeIssuanceReference.repository.js';
import { isNfeApiHomologationDocument } from '../nfeApi/nfeApi.index.js';

export async function reconcileBudgetNfe(budgetId) {
  const reference = await getBudgetNfeReference(budgetId);
  const providerId = await resolveProviderId(reference);
  const response = await tecnospeedNfeApi.consultarNFe(providerId);

  logProviderResult('[BUDGET NFE][RECONCILIACAO]', response);

  if (!response?.ok) {
    const error = new Error('Falha ao consultar a situação da NF-e no provedor.');
    error.status = Number(response?.status) || 502;
    error.code = 'NFE_PROVIDER_STATUS_FAILED';
    error.details = response?.error || null;
    throw error;
  }

  const document = providerDocument(response.data);
  const status = normalizeProviderStatus(document, response.data) ||
    reference.nfe_issue_status || 'PROCESSANDO';
  const protocol = providerProtocolFrom(document, response.data) || reference.nfe_protocol || null;
  const accessKey = providerAccessKeyFrom(document, response.data);
  const message = providerMessageFrom(document, response.data);
  const issueError = ['REJEITADA', 'DENEGADA', 'ERRO'].includes(status)
    ? String(message || 'NF-e não autorizada pelo provedor.')
    : null;

  const statusMap = await resolveNfeStatus(pool, status);
  const isCancelled = status === 'CANCELADA';

  // NF-e de testes (homologação) da NF-e API não tem valor fiscal: registra a
  // nota, mas não baixa/estorna estoque, não muda o status do orçamento e não
  // gera boletos no Asaas.
  const isTestInvoice = isNfeApiHomologationDocument(document, reference.nfe_environment);
  if (isTestInvoice) {
    console.log('[BUDGET NFE][HOMOLOGACAO NF-E API] efeitos de negócio ignorados', {
      budget_id: reference.budget_id,
      status,
    });
  }

  await pool.query(
    `
      UPDATE ${ATTEMPTS_TABLE}
      SET provider_id = $2,
          nfe_status_id = $3,
          protocol = $4,
          access_key = COALESCE($5, access_key),
          nfe_number = COALESCE($6, nfe_number),
          provider_response = $7::jsonb,
          error_code = CASE WHEN $8::text IS NULL THEN NULL ELSE 'NFE_PROVIDER_STATUS' END,
          error_message = $8,
          last_checked_at = NOW(),
          authorized_at = CASE
            WHEN $9::boolean THEN COALESCE(authorized_at, NOW())
            ELSE authorized_at
          END,
          rejected_at = CASE
            WHEN $10::boolean THEN COALESCE(rejected_at, NOW())
            ELSE rejected_at
          END,
          updated_at = NOW()
      WHERE attempt_id = $1
    `,
    [
      reference.attempt_id,
      providerId,
      statusMap.nfe_status_id,
      protocol,
      accessKey,
      document?.numero ? Number(document.numero) : null,
      JSON.stringify(response.data || {}),
      issueError,
      Boolean(statusMap.is_authorized),
      Boolean(statusMap.is_final && !statusMap.is_authorized),
    ],
  );

  // ============================================================================
  // ORÇAMENTO → NF-e CANCELADA → SINCRONIZAÇÃO LOCAL
  // ============================================================================
  let cancellationSync = null;
  let stockRollback = null;

  if (isCancelled) {
    const cancellationDateText = String(
      document?.dataCancelamento || '',
    ).trim();

    const cancellationDateMatch =
      cancellationDateText.match(
        /^(\d{2})\/(\d{2})\/(\d{4})$/,
      );

    const cancelledAt = cancellationDateMatch
      ? `${cancellationDateMatch[3]}-${cancellationDateMatch[2]}-${cancellationDateMatch[1]}`
      : new Date();

    const cancellationProtocol =
      document?.protocoloCancelamento ||
      null;

    const cancellationMessage =
      document?.mensagem ||
      'NF-e cancelada no provedor.';

    const cancellationReason =
      cancellationProtocol
        ? `${cancellationMessage} Protocolo: ${cancellationProtocol}`
        : cancellationMessage;

    await pool.query(
      `
        UPDATE ${ATTEMPTS_TABLE}
        SET cancelled_at = COALESCE(cancelled_at, $2::timestamptz),
            updated_at = NOW()
        WHERE attempt_id = $1
      `,
      [reference.attempt_id, cancelledAt],
    );

    const cancellationResult = await pool.query(
      `
        UPDATE public."invoicesIssued"
        SET nfe_status_id = $2,
            nfe_status = $3,
            cancelled_at = COALESCE(cancelled_at, $4::timestamptz),
            cancellation_reason = $5,
            updated_at = NOW()
        WHERE budget_id = $1
           OR (
                -- Fallback para notas antigas sem budget_id preenchido.
                -- Precisa do ambiente: a sequência de numeração é a mesma para
                -- homologação e produção, então casar apenas por nfe_number
                -- poderia cancelar a nota do outro ambiente.
                budget_id IS NULL
                AND source_type = 'BUDGET'
                AND nfe_number = $6
                AND nfe_environment IS NOT DISTINCT FROM $7::text
              )
        RETURNING *
      `,
      [
        reference.budget_id,
        statusMap.nfe_status_id,
        statusMap.code,
        cancelledAt,
        cancellationReason,
        document?.numero
          ? Number(document.numero)
          : reference.nfe_number,
        document?.ambiente
        || reference.nfe_environment
        || process.env.NFE_AMBIENTE
        || null,
      ],
    );

    if (!isTestInvoice) {
      await pool.query(
        `
          UPDATE public.budgets
          SET status = 'CANCELADO',
              updated_at = NOW()
          WHERE budget_id = $1
        `,
        [reference.budget_id],
      );

      // ======================================================================
      // ORÇAMENTO → NF-e CANCELADA → ESTORNO IDEMPOTENTE DO ESTOQUE
      // ======================================================================
      stockRollback =
        await stockFromBudgetsService
          .rollbackStockFromBudget({
            attemptId:
              reference.attempt_id,
          });
    }

    cancellationSync = {
      ok: cancellationResult.rowCount > 0,
      invoice: cancellationResult.rows[0] || null,
      protocol: cancellationProtocol,
      cancelled_at: cancelledAt,
      reason: cancellationReason,
      stockRollback,
    };
  }

  let stockSync = null;
  let invoicesIssued = null;
  let boletoSync = null;

  if (status === 'AUTORIZADA') {
    const budget = await getBudgetIssuedData(reference.budget_id);

    // ========================================================================
    // ORÇAMENTO → NF-e AUTORIZADA → ESTOQUE
    // ========================================================================
    stockSync = isTestInvoice
      ? { ok: true, skipped: true, reason: 'NF-e de homologação (NF-e API)' }
      : await stockFromBudgetsService
        .applyStockFromBudget(
          budget,
          {
            attemptId:
              reference.attempt_id,
          },
        );

    const authorizationDate = String(
      document?.dataAutorizacao || document?.emissao || '',
    ).trim();
    const dateMatch = authorizationDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    const issuedDate = dateMatch
      ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`
      : null;

    const sync = await invoicesIssuedApi.upsertFromBudget({
      budget_id: Number(reference.budget_id),

      nfe_number:
        document?.numero
          ? Number(document.numero)
          : reference.nfe_number ?? null,

      nfe_key:
        accessKey ||
        reference.access_key ||
        null,

      // Important: provider's internal document ID
      nfe_provider_id: providerId,

      nfe_status: status,

      nfe_protocol:
        protocol ||
        reference.nfe_protocol ||
        null,

      nfe_environment:
        document?.ambiente ||
        reference.nfe_environment ||
        process.env.NFE_AMBIENTE ||
        null,

      xml_url:
        `/api/budgets-issued/${reference.budget_id}/xml`,

      danfe_url:
        `/api/budgets-issued/${reference.budget_id}/danfe.pdf`,

      issued_at:
        reference.nfe_issued_at ||
        new Date(),

      issued_date: issuedDate,

      total_amount: Number(
        budget.total_amount ??
        budget.total ??
        document?.valor ??
        0
      ),

      customer_name:
        budget.customer_legal_name ||
        budget.customer_name ||
        null,

      customer_tax_id:
        budget.customer_tax_id ||
        null,

      customer_email:
        budget.customer_email ||
        budget.email ||
        null,
    });

    if (!sync?.ok) {
      const error = new Error(
        sync?.error || 'Não foi possível sincronizar a NF-e em invoicesIssued.',
      );
      error.status = 500;
      error.code = 'INVOICES_ISSUED_SYNC_FAILED';
      throw error;
    }

    invoicesIssued = sync.invoice || null;

    const linkedInvoiceId =
      invoicesIssued?.invoice_id ??
      sync?.invoice_id ??
      null;

    if (linkedInvoiceId) {
      await pool.query(
        `UPDATE ${ATTEMPTS_TABLE} SET invoice_id = $2, updated_at = NOW() WHERE attempt_id = $1`,
        [reference.attempt_id, linkedInvoiceId],
      );
    }

    // O orçamento só se torna FATURADO depois que estoque e invoicesIssued
    // terminam com sucesso. Operações com moves_stock=false são marcadas pelo
    // serviço de estoque como ignoradas, sem gerar baixa.
    if (!isTestInvoice) {
      await pool.query(
        `
          UPDATE public.budgets
          SET status = 'FATURADO',
              updated_at = NOW()
          WHERE budget_id = $1
        `,
        [reference.budget_id],
      );
    }

    // ============================================================================
    // ORÇAMENTO → NF-e AUTORIZADA → ASAAS → BOLETOS
    // ============================================================================

    if (isTestInvoice) {
      boletoSync = { ok: true, skipped: true, reason: 'NF-e de homologação (NF-e API)' };
    } else try {
      boletoSync =
        await syncAuthorizedBudgetNfe({
          budgetId:
            Number(reference.budget_id),

          nfeNumber:
            document?.numero ||
            null,

          nfeKey:
            accessKey ||
            null,
        });

      console.log(
        '[BUDGET NFE][ASAAS][SYNC]',
        boletoSync,
      );
    } catch (error) {
      console.error(
        '[BUDGET NFE][ASAAS][SYNC ERROR]',
        {
          budgetId:
            reference.budget_id,

          nfeNumber:
            document?.numero ||
            null,

          nfeKey:
            accessKey ||
            null,

          error:
            error?.message ||
            error,
        },
      );

      boletoSync = {
        ok: false,
        error:
          error?.message ||
          'Falha ao gerar boletos.',
      };
    }
  }

  return {
    budget_id: Number(reference.budget_id),
    provider_id: providerId,
    id_integracao: reference.nfe_id_integracao,
    status,
    protocol,
    access_key: accessKey || null,
    message: message || null,
    cancelled: isCancelled,
    environment: reference.nfe_environment || process.env.NFE_AMBIENTE || null,
    xml_url: status === 'AUTORIZADA'
      ? `/api/budgets-issued/${reference.budget_id}/xml`
      : null,
    danfe_url: ['AUTORIZADA', 'CANCELADA'].includes(status)
      ? `/api/budgets-issued/${reference.budget_id}/danfe.pdf`
      : null,
    stock_sync: stockSync,
    stock_rollback: stockRollback,
    invoices_issued: invoicesIssued,
    cancellation_sync: cancellationSync,
    boleto_sync: boletoSync,
  };
}
