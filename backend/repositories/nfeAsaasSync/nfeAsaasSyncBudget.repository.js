// ╔══════════════════════════════════════════════════════════════════╗
// ║ nfeAsaasSyncBudget.repository.js — sync orçamento                ║
// ║ ORÇAMENTO → NF-e autorizada → contas a receber / Asaas opcional  ║
// ╚══════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import * as asaasApi from '../../repositories/asaas/asaas.index.js';
import { makeBudgetExternalReference, buildDescription } from './nfeAsaasSync.utils.js';
import { loadBudgetContext } from './nfeAsaasSyncContext.repository.js';
import { findLocalLink, findRemotePayment } from './nfeAsaasSyncLookup.repository.js';
import { persistLocalReceivable, persistLink } from './nfeAsaasSyncPersist.repository.js';

// ============================================================================
// ORÇAMENTO → NF-e AUTORIZADA → CONTAS A RECEBER / ASAAS OPCIONAL
// ============================================================================

export async function syncAuthorizedBudgetNfe({
  budgetId,
  nfeNumber,
  nfeKey,
} = {}) {
  const id = Number(budgetId);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('budgetId inválido.');
  }

  const client = await pool.connect();
  let lockAcquired = false;

  try {
    await client.query('SELECT pg_advisory_lock($1, $2)', [73115, id]);
    lockAcquired = true;

    const { budget, installments } = await loadBudgetContext(client, id);
    const result = {
      ok: true,
      partial: false,
      budgetId: id,
      found: installments.length,
      receivablesCreated: 0,
      receivablesReused: 0,
      created: 0,
      reused: 0,
      linked: 0,
      failed: [],
      skipped: installments.length ? 0 : 1,
      payments: [],
    };

    if (!installments.length) {
      console.log('[BUDGET NFE][FINANCE] Nenhuma parcela financeira para sincronizar.', {
        budgetId: id,
        generatesReceivable: budget.generates_receivable,
      });
      return result;
    }

    for (const installment of installments) {
      const effectiveNfeNumber = nfeNumber || budget.nfe_number || 'SN';
      const effectiveNfeKey = nfeKey || budget.nfe_key || null;
      const externalReference = makeBudgetExternalReference({
        nfeKey: effectiveNfeKey,
        nfeNumber: effectiveNfeNumber,
        budgetId: id,
        paymentId: installment.budget_payment_id,
        installment: installment.installment,
      });

      try {
        // 1) Always create/reuse Accounts Receivable first.
        await client.query('BEGIN');
        let localReceivable;
        try {
          localReceivable = await persistLocalReceivable(client, {
            context: budget,
            installment,
            externalReference,
            nfeNumber: effectiveNfeNumber,
          });
          await client.query('COMMIT');
        } catch (persistError) {
          await client.query('ROLLBACK');
          throw persistError;
        }

        if (localReceivable.created) result.receivablesCreated += 1;
        else result.receivablesReused += 1;

        // 2) Manual boleto / no integration / other local collection stops here.
        if (!installment.automaticAsaas) {
          result.linked += 1;
          result.payments.push({
            installment: installment.sequence,
            sourceInstallment: installment.installment,
            dueDate: installment.dueDate,
            value: installment.value,
            externalReference,
            source: localReceivable.created ? 'local-created' : 'local-reused',
            accountsReceivableId: localReceivable.accountsReceivableId,
            collectionProvider: localReceivable.collectionProvider,
            originalCollectionProvider: installment.collection_provider || null,
            boletoMode: installment.boleto_mode || null,
          });
          continue;
        }

        // 3) ASAAS/AUTOMATIC: create or reuse the remote charge.
        const localLink = await findLocalLink(client, externalReference);
        let payment = null;
        let source = 'created';

        if (localLink?.asaas_payment_id) {
          try {
            payment = await asaasApi.getPayment(localLink.asaas_payment_id);
          } catch {
            payment = {
              ...(localLink.raw || {}),
              id: localLink.asaas_payment_id,
              status: localLink.last_status || 'PENDING',
            };
          }

          source = 'local';
          result.reused += 1;
        } else {
          payment = await findRemotePayment(externalReference);

          if (payment?.id) {
            source = 'remote';
            result.reused += 1;
          } else {
            payment = await asaasApi.createCharge({
              customerId: budget.asaas_id,
              billingType: 'BOLETO',
              value: installment.value,
              dueDate: installment.dueDate,
              description: buildDescription(effectiveNfeNumber, installment.sequence),
              externalReference,
            });
            result.created += 1;
          }
        }

        // 4) Persist/update AR from Asaas and bridge the remote payment.
        const context = {
          ...budget,
          nfe_number: effectiveNfeNumber,
        };

        await client.query('BEGIN');
        try {
          const linked = await persistLink(client, {
            order: context,
            installment,
            payment,
            externalReference,
            nfeNumber: effectiveNfeNumber,
          });

          await client.query('COMMIT');
          result.linked += 1;
          result.payments.push({
            installment: installment.sequence,
            sourceInstallment: installment.installment,
            dueDate: installment.dueDate,
            value: installment.value,
            externalReference,
            source,
            ...linked,
          });
        } catch (persistError) {
          await client.query('ROLLBACK');
          throw persistError;
        }
      } catch (error) {
        const errorMessage =
          error?.response?.data?.errors?.[0]?.description ||
          error?.response?.data?.message ||
          error?.message ||
          String(error);

        result.failed.push({
          installment: installment.sequence,
          sourceInstallment: installment.installment,
          dueDate: installment.dueDate,
          value: installment.value,
          externalReference,
          error: errorMessage,
        });

        console.error('[BUDGET NFE][FINANCE][PARCELA][ERRO]', {
          budgetId: id,
          installment: installment.sequence,
          sourceInstallment: installment.installment,
          externalReference,
          error: errorMessage,
        });
      }
    }

    result.partial = result.failed.length > 0 && result.linked > 0;
    result.ok = result.failed.length === 0;

    console.log('[BUDGET NFE][FINANCE][RESULT]', result);
    return result;
  } finally {
    if (lockAcquired) {
      try {
        await client.query('SELECT pg_advisory_unlock($1, $2)', [73115, id]);
      } catch (unlockError) {
        console.error('[BUDGET NFE][FINANCE][UNLOCK][ERRO]', unlockError?.message || unlockError);
      }
    }

    client.release();
  }
}
