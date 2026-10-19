// ╔════════════════════════════════════════════════════════════════════════╗
// ║ budgetsPaymentInstallmentsGenerate.repository.js — geração de parcelas ║
// ║ generateFromBudgetPayment / generateFromBudget                         ║
// ╚════════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import {
  TB_INSTALLMENTS,
  TB_BUDGETS_PAYMENTS,
  Q_PAYMENT_FK,
  Q_PAYMENT_PK,
  DEFAULT_STATUS,
  DEFAULT_PAID_AMOUNT,
} from './budgetsPaymentInstallments.constants.js';
import {
  toInt,
  round2,
} from './budgetsPaymentInstallments.sanitizers.js';
import {
  toDateOnly,
  addDays,
  todayInSaoPaulo,
  splitAmount,
  normalizeInstallmentsCount,
  extractGaps,
} from './budgetsPaymentInstallments.utils.js';
import {
  fitText,
  insertInstallment,
} from './budgetsPaymentInstallmentsPersist.repository.js';
import {
  fetchByBudgetPayment,
  getBudgetPaymentSource,
} from './budgetsPaymentInstallmentsLookup.repository.js';

export async function generateFromBudgetPayment(budgetPaymentId, options = {}) {
  const safeBudgetPaymentId = toInt(budgetPaymentId);
  if (!safeBudgetPaymentId) throw new Error('budget_payment_id inválido.');

  const externalClient = options.client || null;
  const client = externalClient || await pool.connect();

  try {
    if (!externalClient) await client.query('BEGIN');

    const source = await getBudgetPaymentSource(client, safeBudgetPaymentId);
    if (!source) {
      throw new Error('Linha de pagamento do budget não encontrada.');
    }

    if (!source.payment_method_id_ref) {
      throw new Error('payment_method_id da budgetsPayments não encontrado em paymentMethods.');
    }

    const budgetId = toInt(source.budget_id);
    const totalAmount = round2(source.amount);
    // ========================================================================
    // REGRA DE GERAÇÃO DAS DATAS
    // ========================================================================
    //
    // O prazo normal parte da data corrente em São Paulo, salvo base_date
    // explícita. Se existir manual_due_date, ela representa o vencimento
    // real da PRIMEIRA parcela, e não uma nova data-base para somar gap_1.
    //
    // ========================================================================
    // DATA-BASE / VENCIMENTO MANUAL
    // ========================================================================
    //
    // Regra:
    // - Sem manual_due_date:
    //     cada gap é absoluto em relação à data-base.
    //
    //   Ex.: base 23/08 + gaps 7/14
    //        => 30/08 e 06/09
    //
    // - Com manual_due_date:
    //     a primeira parcela vence EXATAMENTE na data informada.
    //     As próximas preservam o intervalo entre gap_1 e gap_n.
    //
    //   Ex.: manual 30/08 + gaps 7/14
    //        => 30/08 e 06/09
    //
    const configuredBaseDate = toDateOnly(
      options.base_date ||
      todayInSaoPaulo()
    );

    const manualDueDate = toDateOnly(
      source.manual_due_date
    );

    if (!budgetId) throw new Error('budget_id inválido para geração de parcelas.');
    if (totalAmount < 0) throw new Error('amount da linha de pagamento é inválido.');

    const installmentsCount = normalizeInstallmentsCount(source);
    const gaps = extractGaps(source, installmentsCount);
    const amounts = splitAmount(totalAmount, installmentsCount);

    await client.query(
      `DELETE FROM ${TB_INSTALLMENTS} WHERE ${Q_PAYMENT_FK} = $1`,
      [safeBudgetPaymentId]
    );

    /*
     * notes da parcela tem o mesmo limite que notes do pagamento; com o
     * prefixo, uma observação longa estourava varchar(255) e abortava a
     * geração inteira.
     */
    const note = fitText(
      source.notes
        ? `Gerado automaticamente | ${String(source.notes).trim()}`
        : 'Gerado automaticamente',
      'notes'
    );

    for (let i = 0; i < installmentsCount; i += 1) {
      const installmentNumber = i + 1;
      let dueDate = null;

      if (manualDueDate) {
        if (i === 0) {
          // Primeira parcela = exatamente a data informada pelo usuário.
          dueDate = manualDueDate;
        } else {
          // Próximas parcelas mantêm o espaçamento configurado
          // em relação à primeira condição (gap_1).
          const firstGap = Number(gaps[0] || 0);
          const currentGap = Number(gaps[i] || 0);
          const relativeDays = currentGap - firstGap;

          dueDate = addDays(
            manualDueDate,
            relativeDays
          );
        }
      } else {
        // Sem vencimento manual:
        // cada gap é absoluto em relação à data-base.
        dueDate = addDays(
          configuredBaseDate,
          gaps[i] || 0
        );
      }

      if (!dueDate) {
        throw new Error(
          `Não foi possível calcular o vencimento da parcela ${installmentNumber}.`
        );
      }

      await insertInstallment(client, {
        budget_payment_id: safeBudgetPaymentId,
        budget_id: budgetId,
        installment_number: installmentNumber,
        due_date: dueDate,
        amount: amounts[i],
        status: DEFAULT_STATUS,
        paid_amount: DEFAULT_PAID_AMOUNT,
        paid_at: null,
        notes: note
      });
    }

    if (!externalClient) await client.query('COMMIT');

    /*
     * Lê pelo MESMO client: com transação externa as parcelas ainda não
     * foram commitadas, e uma leitura pelo pool devolvia rows vazio.
     */
    const generatedRows = await fetchByBudgetPayment(client, safeBudgetPaymentId);

    return {
      budget_payment_id: safeBudgetPaymentId,
      budget_id: budgetId,
      payment_method_id: Number(source.payment_method_id_ref),
      payment_method_name: source.payment_method_name || null,
      payment_method_type: source.payment_method_type || null,
      installments_count: installmentsCount,
      total_amount: totalAmount,
      base_date: configuredBaseDate,
      manual_due_date: manualDueDate,
      rows: generatedRows
    };
  } catch (error) {
    if (!externalClient) await client.query('ROLLBACK');
    throw error;
  } finally {
    if (!externalClient) client.release();
  }
}

export async function generateFromBudget(budgetId, options = {}) {
  const safeBudgetId = toInt(budgetId);
  if (!safeBudgetId) throw new Error('budget_id inválido.');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `
      SELECT ${Q_PAYMENT_PK} AS budget_payment_id
        FROM ${TB_BUDGETS_PAYMENTS}
       WHERE budget_id = $1
       ORDER BY ${Q_PAYMENT_PK} ASC
      `,
      [safeBudgetId]
    );

    const results = [];

    for (const row of rows) {
      const generated = await generateFromBudgetPayment(row.budget_payment_id, {
        client,
        base_date: options.base_date
      });
      results.push(generated);
    }

    await client.query('COMMIT');

    return {
      budget_id: safeBudgetId,
      payments_count: rows.length,
      generated: results
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
