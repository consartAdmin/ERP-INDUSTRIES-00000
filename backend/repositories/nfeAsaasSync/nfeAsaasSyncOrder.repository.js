// ╔══════════════════════════════════════════════════════════════════╗
// ║ nfeAsaasSyncOrder.repository.js — sync pedido                    ║
// ║ PEDIDO → NF-e autorizada → contas a receber / Asaas opcional     ║
// ╚══════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import * as asaasApi from '../../repositories/asaas/asaas.index.js';
import { makeExternalReference, buildDescription } from './nfeAsaasSync.utils.js';
import { loadContext } from './nfeAsaasSyncContext.repository.js';
import { findLocalLink, findRemotePayment } from './nfeAsaasSyncLookup.repository.js';
import { persistLocalReceivable, persistLink } from './nfeAsaasSyncPersist.repository.js';

// ============================================================================
// PEDIDO → NF-e AUTORIZADA → CONTAS A RECEBER / ASAAS OPCIONAL
// ============================================================================

export async function syncAuthorizedNfe({ orderId, nfeNumber, nfeKey } = {}) {
  const id = Number(orderId);
  if (!Number.isInteger(id) || id <= 0) throw new Error('orderId inválido.');

  const client = await pool.connect();
  let lockAcquired = false;

  try {
    await client.query('SELECT pg_advisory_lock($1, $2)', [73114, id]);
    lockAcquired = true;

    const { order, installments } = await loadContext(client, id);
    const result = {
      ok: true,
      partial: false,
      orderId: id,
      budgetId: order.budget_id,
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

    for (const installment of installments) {
      const externalReference = makeExternalReference({
        nfeKey: nfeKey || order.nfe_key,
        nfeNumber: nfeNumber || order.nfe_number,
        orderId: id,
        paymentId: installment.budget_payment_id,
        installment: installment.installment,
      });

      try {
        // 1) Financial title exists independently from the collection provider.
        await client.query('BEGIN');
        let localReceivable;
        try {
          localReceivable = await persistLocalReceivable(client, {
            context: order,
            installment,
            externalReference,
            nfeNumber: nfeNumber || order.nfe_number,
          });
          await client.query('COMMIT');
        } catch (persistError) {
          await client.query('ROLLBACK');
          throw persistError;
        }

        if (localReceivable.created) result.receivablesCreated += 1;
        else result.receivablesReused += 1;

        // 2) MANUAL / NO_INTEGRATION / other local methods stop here.
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
            boletoMode: installment.boleto_mode || null,
          });
          continue;
        }

        // 3) Only automatic ASAAS boleto reaches the remote provider.
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
              customerId: order.asaas_id,
              billingType: 'BOLETO',
              value: installment.value,
              dueDate: installment.dueDate,
              description: buildDescription(
                nfeNumber || order.nfe_number || 'SN',
                installment.sequence,
              ),
              externalReference,
            });
            result.created += 1;
          }
        }

        await client.query('BEGIN');
        try {
          const linked = await persistLink(client, {
            order,
            installment,
            payment,
            externalReference,
            nfeNumber: nfeNumber || order.nfe_number,
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

        console.error('[NFE][FINANCE][ORDER][PARCELA][ERRO]', {
          orderId: id,
          installment: installment.sequence,
          sourceInstallment: installment.installment,
          externalReference,
          error: errorMessage,
        });
      }
    }

    result.partial = result.failed.length > 0 && result.linked > 0;
    result.ok = result.failed.length === 0;

    return result;
  } finally {
    if (lockAcquired) {
      try {
        await client.query('SELECT pg_advisory_unlock($1, $2)', [73114, id]);
      } catch (unlockError) {
        console.error('[NFE][FINANCE][ORDER][UNLOCK][ERRO]', unlockError?.message || unlockError);
      }
    }
    client.release();
  }
}
