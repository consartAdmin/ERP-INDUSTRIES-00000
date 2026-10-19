// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsPaymentsReplace.repository.js — replaceBudgetPayments         ║
// ║ Recria os pagamentos e reaplica vencimentos manuais                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import budgetsPaymentInstallmentsApi from '../budgetsPaymentInstallments/budgetsPaymentInstallments.index.js';
import {
  quoteIdent,
  TB_PAYMENTS,
  TB_INSTALLMENTS,
  REF_INSTALLMENTS,
} from './budgetsPayments.constants.js';
import {
  toInt,
  round2,
  normalizeText,
  normalizeIsoDate,
} from './budgetsPayments.sanitizers.js';
import {
  getBudgetById,
  getPaymentMethodById,
  resolveBankAccount,
} from './budgetsPaymentsLookup.repository.js';
import {
  buildPaymentRecord,
  insertPayment,
} from './budgetsPaymentsPersist.repository.js';
import {
  getById,
} from './budgetsPaymentsQuery.repository.js';
import {
  validateBudgetPaymentsTotal,
} from './budgetsPaymentsValidate.repository.js';

export async function replaceBudgetPayments(budgetId, payments = [], options = {}) {
  const safeBudgetId = toInt(budgetId);

  if (!safeBudgetId) {
    throw new Error('budget_id inválido.');
  }

  if (!Array.isArray(payments)) {
    throw new Error('payments deve ser um array.');
  }

  const installments = Array.isArray(options.installments)
    ? options.installments
    : [];

  const autoGenerateInstallments = Boolean(
    options.auto_generate_installments ?? true
  );

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const budget = await getBudgetById(client, safeBudgetId);

    if (!budget) {
      throw new Error('Budget não encontrado.');
    }

    /*
     * Mantém o vínculo entre o pagamento que veio do frontend
     * e o novo budget_payment_id criado pelo REPLACE.
     */
    const created = [];
    const paymentMap = [];

    /*
     * O replace recria os pagamentos.
     *
     * As parcelas antigas são removidas pelo ON DELETE CASCADE de
     * budgetsPaymentInstallments (ver referencedBy no catálogo).
     */
    await client.query(
      `DELETE FROM ${TB_PAYMENTS} WHERE budget_id = $1`,
      [safeBudgetId]
    );

    for (let paymentIndex = 0; paymentIndex < payments.length; paymentIndex += 1) {
      const item = payments[paymentIndex] || {};
      const lineLabel = `na linha ${paymentIndex + 1}`;

      const paymentMethodId = toInt(item.payment_method_id);
      const amount = round2(item.amount);
      const notes = normalizeText(item.notes);
      const manualDueDate = normalizeIsoDate(item.manual_due_date);

      if (!paymentMethodId) {
        throw new Error(
          `payment_method_id é obrigatório ${lineLabel}.`
        );
      }

      if (amount < 0) {
        throw new Error(
          `amount não pode ser negativo ${lineLabel}.`
        );
      }

      const method = await getPaymentMethodById(client, paymentMethodId);

      if (!method) {
        throw new Error(
          `Forma de pagamento não encontrada: ${paymentMethodId}`
        );
      }

      if (method.active === false) {
        throw new Error(
          `Forma de pagamento inativa: ${paymentMethodId}`
        );
      }

      const bankAccount = await resolveBankAccount(
        client,
        item.bank_account_id
      );

      const newBudgetPaymentId = await insertPayment(
        client,
        buildPaymentRecord({
          budgetId: safeBudgetId,
          paymentMethodId,
          bankAccount,
          amount,
          notes,
          manualDueDate
        }),
        lineLabel
      );

      /*
       * Guarda os dois IDs para conseguirmos associar as parcelas
       * que vieram do frontend às parcelas do novo pagamento.
       */
      paymentMap.push({
        payment_index: paymentIndex,

        old_budget_payment_id:
          toInt(
            item.budget_payment_id ??
            item.payment_id
          ),

        payment_method_id:
          paymentMethodId,

        bank_account_id:
          bankAccount.bank_account_id,

        collection_provider:
          bankAccount.collection_provider,

        boleto_mode:
          bankAccount.boleto_mode,

        new_budget_payment_id:
          newBudgetPaymentId
      });

      /*
       * Gera a estrutura base das parcelas.
       *
       * Depois, logo abaixo, os vencimentos manuais enviados
       * pelo frontend são reaplicados sobre essas parcelas.
       */
      if (autoGenerateInstallments) {
        await budgetsPaymentInstallmentsApi.generateFromBudgetPayment(
          newBudgetPaymentId,
          { client }
        );
      }

      created.push(newBudgetPaymentId);
    }

    /*
     * ============================================================
     * PRESERVA VENCIMENTOS EDITADOS MANUALMENTE
     * ============================================================
     *
     * O frontend deve enviar:
     *
     * {
     *   payments: [...],
     *   installments: [
     *     {
     *       budget_payment_id,
     *       payment_method_id,
     *       installment_number,
     *       due_date,
     *       amount,
     *       status
     *     }
     *   ]
     * }
     *
     * Como os pagamentos foram recriados, os IDs mudaram.
     * paymentMap faz a associação do ID antigo com o novo.
     */
    if (installments.length) {
      for (let installmentIndex = 0; installmentIndex < installments.length; installmentIndex += 1) {
        const installment = installments[installmentIndex] || {};

        const installmentNumber = toInt(
          installment.installment_number ??
          installment.parcela ??
          installment.number
        );

        if (!installmentNumber || installmentNumber < 1) {
          continue;
        }

        const dueDate = normalizeIsoDate(
          installment.due_date ??
          installment.manual_due_date ??
          installment.data_vencimento ??
          installment.vencimento
        );

        /*
         * Se não existe vencimento válido, não sobrescrevemos
         * a data calculada automaticamente.
         */
        if (!dueDate) {
          continue;
        }

        const oldBudgetPaymentId = toInt(
          installment.budget_payment_id ??
          installment.payment_id
        );

        const installmentPaymentMethodId = toInt(
          installment.payment_method_id ??
          installment.paymentMethods_id ??
          installment.method_id
        );

        const explicitPaymentIndex = toInt(
          installment.payment_index,
          null
        );

        let mappedPayment = null;

        /*
         * 1) Melhor associação: payment_index.
         *
         * Útil principalmente quando existem duas formas de
         * pagamento iguais no mesmo orçamento.
         */
        if (
          explicitPaymentIndex !== null &&
          explicitPaymentIndex >= 0
        ) {
          mappedPayment =
            paymentMap.find(
              (row) =>
                row.payment_index === explicitPaymentIndex
            ) || null;
        }

        /*
         * 2) Associação pelo budget_payment_id antigo.
         */
        if (!mappedPayment && oldBudgetPaymentId) {
          mappedPayment =
            paymentMap.find(
              (row) =>
                row.old_budget_payment_id === oldBudgetPaymentId
            ) || null;
        }

        /*
         * 3) Fallback pelo método de pagamento.
         */
        if (!mappedPayment && installmentPaymentMethodId) {
          mappedPayment =
            paymentMap.find(
              (row) =>
                row.payment_method_id === installmentPaymentMethodId
            ) || null;
        }

        /*
         * 4) Último fallback:
         * se há somente um pagamento, a associação é inequívoca.
         */
        if (!mappedPayment && paymentMap.length === 1) {
          mappedPayment = paymentMap[0];
        }

        if (!mappedPayment) {
          console.warn(
            '[budgetsPaymentsApi][replace] Não foi possível mapear parcela manual.',
            {
              installmentIndex,
              oldBudgetPaymentId,
              installmentPaymentMethodId,
              installmentNumber
            }
          );

          continue;
        }

        const params = [
          mappedPayment.new_budget_payment_id,
          installmentNumber,
          dueDate
        ];

        /*
         * Atualiza exatamente a parcela recém-gerada.
         */
        const updateSql = `
          UPDATE ${TB_INSTALLMENTS}
             SET due_date = $3
           WHERE ${quoteIdent(REF_INSTALLMENTS.column)} = $1
             AND installment_number = $2
        `;

        const updateResult = await client.query(
          updateSql,
          params
        );

        /*
         * Se auto_generate_installments=false e nenhuma parcela
         * existir, criamos a parcela com os dados enviados.
         */
        if (
          updateResult.rowCount === 0 &&
          !autoGenerateInstallments
        ) {
          const installmentAmount = round2(
            installment.amount
          );

          const status = normalizeText(
            installment.status,
            'PENDENTE'
          );

          const notesInstallment = normalizeText(
            installment.notes
          );

          await client.query(
            `
              INSERT INTO ${TB_INSTALLMENTS} (
                ${quoteIdent(REF_INSTALLMENTS.column)},
                budget_id,
                installment_number,
                due_date,
                amount,
                status,
                paid_amount,
                paid_at,
                notes
              )
              VALUES ($1,$2,$3,$4,$5,$6,0,NULL,$7)
            `,
            [
              mappedPayment.new_budget_payment_id,
              safeBudgetId,
              installmentNumber,
              dueDate,
              installmentAmount,
              status,
              notesInstallment
            ]
          );
        }
      }
    }

    await client.query('COMMIT');

    const rows = [];

    for (const id of created) {
      const row = await getById(id);

      if (row) {
        rows.push(row);
      }
    }

    const validation =
      await validateBudgetPaymentsTotal(
        safeBudgetId
      );

    return {
      budget_id: safeBudgetId,
      count: rows.length,
      rows,
      payment_map: paymentMap,
      installments_received: installments.length,
      validation
    };

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;

  } finally {
    client.release();
  }
}
