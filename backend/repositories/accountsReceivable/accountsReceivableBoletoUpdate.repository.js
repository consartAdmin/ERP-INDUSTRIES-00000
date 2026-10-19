// ╔════════════════════════════════════════════════════════════════════╗
// ║ accountsReceivableBoletoUpdate.repository.js — Boleto Asaas        ║
// ║ updateBoletoValueAndDueDate / cancelAsaasBoleto                    ║
// ║ Atualiza primeiro o Asaas e depois o PostgreSQL                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import * as asaasApi from '../asaas/asaas.index.js';
import { TB, TB_BRIDGE } from './accountsReceivable.constants.js';
import { toInt } from './accountsReceivable.sanitizers.js';
import { persistAsaasRawForAr } from './accountsReceivableBridge.repository.js';

/* ===================================================================
   BOLETO — ATUALIZAR VENCIMENTO E VALOR
   Atualiza primeiro o Asaas e depois o PostgreSQL
=================================================================== */

export async function updateBoletoValueAndDueDate(
  accountsReceivableId,
  {
    due_date,
    value,
  } = {}
) {
  const id = Number(accountsReceivableId);
  const normalizedValue = Number(value);
  const normalizedDueDate =
    String(due_date || '').trim();

  /* -----------------------------------------------------------------
     1. Validação
  ----------------------------------------------------------------- */

  if (!Number.isInteger(id) || id <= 0) {
    const error =
      new Error('ID da conta a receber inválido.');

    error.statusCode = 400;
    throw error;
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      normalizedDueDate
    )
  ) {
    const error =
      new Error('Informe um vencimento válido.');

    error.statusCode = 400;
    throw error;
  }

  if (
    !Number.isFinite(normalizedValue) ||
    normalizedValue <= 0
  ) {
    const error =
      new Error('Informe um valor maior que zero.');

    error.statusCode = 400;
    throw error;
  }

  /* -----------------------------------------------------------------
     2. Localiza a conta e seu boleto no Asaas
  ----------------------------------------------------------------- */

  const findSql = `
    SELECT
      ar.id,
      ar.status,
      ar.value,
      ar.amount_paid,
      ar.due_date,
      asa.asaas_payment_id
    FROM ${TB} ar
    LEFT JOIN ${TB_BRIDGE} asa
      ON asa.accounts_receivable_id = ar.id
    WHERE ar.id = $1
    LIMIT 1;
  `;

  const {
    rows: accountRows,
  } = await pool.query(findSql, [id]);

  const account = accountRows[0];

  if (!account) {
    const error =
      new Error('Conta a receber não encontrada.');

    error.statusCode = 404;
    throw error;
  }

  const currentStatus =
    String(account.status || '').toUpperCase();

  if (
    currentStatus === 'PAID' ||
    currentStatus === 'CANCELLED'
  ) {
    const error = new Error(
      currentStatus === 'PAID'
        ? 'Não é possível alterar um boleto já recebido.'
        : 'Não é possível alterar um boleto cancelado.'
    );

    error.statusCode = 409;
    throw error;
  }

  const amountPaid =
    Number(account.amount_paid || 0);

  if (normalizedValue < amountPaid) {
    const error = new Error(
      'O novo valor não pode ser menor que o valor já recebido.'
    );

    error.statusCode = 400;
    throw error;
  }

  const asaasPaymentId =
    String(account.asaas_payment_id || '').trim();

  if (!asaasPaymentId) {
    const error = new Error(
      'Esta conta não possui um boleto vinculado ao Asaas.'
    );

    error.statusCode = 400;
    throw error;
  }

  /* -----------------------------------------------------------------
     3. Atualiza primeiro no Asaas
  ----------------------------------------------------------------- */

  let updatedAsaasPayment;

  try {
    updatedAsaasPayment =
      await asaasApi.updatePayment(
        asaasPaymentId,
        {
          dueDate: normalizedDueDate,
          value: normalizedValue,
        }
      );
  } catch (error) {
    console.error(
      '[AR][UPDATE-BOLETO][ASAAS]',
      {
        accountsReceivableId: id,
        asaasPaymentId,
        dueDate: normalizedDueDate,
        value: normalizedValue,
        error: error?.message || String(error),
      }
    );

    const asaasError = new Error(
      error?.message ||
      'O Asaas recusou a alteração do boleto.'
    );

    asaasError.statusCode =
      Number(error?.response?.status) || 502;

    throw asaasError;
  }

  /* -----------------------------------------------------------------
     4. Atualiza PostgreSQL
  ----------------------------------------------------------------- */

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const updateAccountSql = `
      UPDATE ${TB}
      SET
        due_date  = $1,
        value     = $2,
        updated_at = now()
      WHERE id = $3
        AND UPPER(COALESCE(status, '')) NOT IN (
          'PAID',
          'CANCELLED'
        )
      RETURNING
        id,
        customer_id,
        invoice_number,
        description,
        due_date,
        value,
        amount_paid,
        status,
        created_at,
        updated_at;
    `;

    const {
      rows: updatedRows,
    } = await client.query(
      updateAccountSql,
      [
        normalizedDueDate,
        normalizedValue,
        id,
      ]
    );

    const updatedAccount =
      updatedRows[0];

    if (!updatedAccount) {
      const error = new Error(
        'A situação da conta mudou durante a atualização. Sincronize novamente com o Asaas.'
      );

      error.statusCode = 409;
      throw error;
    }

    const rawPatch = {
      dueDate:
        updatedAsaasPayment?.dueDate ||
        normalizedDueDate,

      value:
        Number(
          updatedAsaasPayment?.value ??
          normalizedValue
        ),

      updatedByErp: true,
      updatedByErpAt:
        new Date().toISOString(),
    };

    const updateBridgeSql = `
      UPDATE ${TB_BRIDGE}
      SET
        raw = COALESCE(raw, '{}'::jsonb)
          || $1::jsonb,
        updated_at = now()
      WHERE accounts_receivable_id = $2
        AND asaas_payment_id = $3;
    `;

    await client.query(
      updateBridgeSql,
      [
        JSON.stringify(rawPatch),
        id,
        asaasPaymentId,
      ]
    );

    await client.query('COMMIT');

    return {
      ...updatedAccount,

      asaas_payment_id:
        asaasPaymentId,

      asaas: {
        id:
          updatedAsaasPayment?.id ||
          asaasPaymentId,

        dueDate:
          updatedAsaasPayment?.dueDate ||
          normalizedDueDate,

        value:
          Number(
            updatedAsaasPayment?.value ??
            normalizedValue
          ),

        status:
          updatedAsaasPayment?.status ||
          currentStatus,
      },
    };
  } catch (error) {
    await client.query('ROLLBACK');

    console.error(
      '[AR][UPDATE-BOLETO][POSTGRES]',
      {
        accountsReceivableId: id,
        asaasPaymentId,
        error: error?.message || String(error),
      }
    );

    throw error;
  } finally {
    client.release();
  }
}

// -------------------------------------------------------------------
// CANCELAR / REMOVER BOLETO (ASAAS + ERP)
// -------------------------------------------------------------------
export async function cancelAsaasBoleto(accountsReceivableId, { reason } = {}) {
  const id = toInt(accountsReceivableId, 0);
  if (!id) throw new Error('ID inválido.');

  const q = `
    SELECT
      ar.id,
      ar.status,
      ar.amount_paid,
      asa.asaas_payment_id,
      asa.raw,
      asa.last_status
    FROM ${TB} ar
    LEFT JOIN ${TB_BRIDGE} asa
      ON asa.accounts_receivable_id = ar.id
    WHERE ar.id = $1
    LIMIT 1;
  `;
  const { rows } = await pool.query(q, [id]);
  const row = rows[0];

  if (!row) throw new Error('Conta não encontrada.');
  if (!row.asaas_payment_id) throw new Error('Esta conta não possui cobrança vinculada no Asaas.');

  const st = String(row.status || '').toUpperCase();
  if (st === 'PAID') throw new Error('Não é permitido cancelar boleto com status PAID.');
  if (st === 'CANCELLED') return { ok: true, message: 'Boleto já estava cancelado.', id };

  let cancelledPayment = null;
  try {
    cancelledPayment = await asaasApi.cancelPayment(row.asaas_payment_id);
  } catch (e) {
    throw new Error(`Falha ao cancelar no Asaas: ${e.message}`);
  }

  // Transação em um único client: BEGIN/COMMIT via pool.query podem
  // cair em conexões diferentes e deixar uma transação aberta no pool.
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const updAR = `
      UPDATE ${TB}
      SET
        status = 'CANCELLED',
        updated_at = now()
      WHERE id = $1
      RETURNING id, status, updated_at;
    `;
    const { rows: arRows } = await client.query(updAR, [id]);

    const patch = {
      cancelledAt: new Date().toISOString(),
      cancelReason: reason || null,
      asaasCancelResponse: cancelledPayment || null,
    };

    await persistAsaasRawForAr(id, patch, client);

    const updBridge = `
      UPDATE ${TB_BRIDGE}
      SET
        last_status = 'CANCELLED',
        updated_at = now()
      WHERE asaas_payment_id = $1;
    `;
    await client.query(updBridge, [row.asaas_payment_id]);

    await client.query('COMMIT');
    return { ok: true, message: 'Boleto cancelado no Asaas e atualizado no ERP.', data: arRows[0] };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
