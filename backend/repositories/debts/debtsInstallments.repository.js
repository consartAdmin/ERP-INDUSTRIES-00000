// ╔════════════════════════════════════════════════════════════════════╗
// ║ debtsInstallments.repository.js — createInstallments               ║
// ║ Gera N parcelas em public.debts (transação, parent = 1ª parcela)   ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_DEBTS } from './debts.constants.js';
import {
  roundMoney,
  safeText,
  normalizeDate,
  normalizeMonth,
  normalizeYear,
  computeUpdatedAmount,
  computeOpenAmount,
  computeStatus,
  buildFirstDueDateFromIssue
} from './debts.utils.js';

export async function createInstallments(payload = {}) {
  const description = safeText(payload.description, 255);
  const debtType = safeText(payload.debt_type, 50);

  const agreementClosedAt = normalizeDate(payload.agreement_closed_at);

  const firstInstallmentDueAt =
    normalizeDate(payload.first_installment_due_at) ||
    normalizeDate(payload.first_due_date) ||
    normalizeDate(payload.due_date) ||
    buildFirstDueDateFromIssue(payload.issue_date, payload.due_day);

  const dueDate = firstInstallmentDueAt;

  const installments = Number(payload.installment_total || payload.installments || 0);
  const totalAmount = roundMoney(payload.total_amount || payload.original_amount);

  if (!description) throw new Error('description é obrigatório.');
  if (!debtType) throw new Error('debt_type é obrigatório.');
  if (!dueDate) throw new Error('first_due_date é obrigatório.');

  if (!Number.isInteger(installments) || installments <= 0) {
    throw new Error('installment_total inválido.');
  }

  if (totalAmount <= 0) {
    throw new Error('total_amount deve ser maior que zero.');
  }

  const baseData = {
    code: safeText(payload.code, 30),
    description,
    creditor_name: safeText(payload.creditor_name, 200),
    creditor_document: safeText(payload.creditor_document, 20),
    debt_type: debtType,
    category: safeText(payload.category, 100),
    cost_center: safeText(payload.cost_center, 100),
    company_name: safeText(payload.company_name, 150),
    document_number: safeText(payload.document_number, 50),
    reference_number: safeText(payload.reference_number, 50),
    issue_date: normalizeDate(payload.issue_date),
    agreement_closed_at: agreementClosedAt,
    first_installment_due_at: firstInstallmentDueAt,
    competence_month: normalizeMonth(payload.competence_month),
    competence_year: normalizeYear(payload.competence_year),
    interest_amount: 0,
    fine_amount: 0,
    discount_amount: 0,
    notes: safeText(payload.notes, 5000),
    is_installment: true
  };

  const eachRaw = roundMoney(totalAmount / installments);
  const generated = [];

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let parentDebtId = null;
    let runningTotal = 0;

    for (let i = 1; i <= installments; i++) {
      const dt = new Date(`${dueDate}T00:00:00`);
      dt.setMonth(dt.getMonth() + (i - 1));

      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const d = String(dt.getDate()).padStart(2, '0');
      const installmentDueDate = `${y}-${m}-${d}`;

      let installmentValue = eachRaw;

      if (i < installments) {
        runningTotal = roundMoney(runningTotal + installmentValue);
      } else {
        installmentValue = roundMoney(totalAmount - runningTotal);
      }

      const updatedAmount = computeUpdatedAmount({
        original_amount: installmentValue,
        interest_amount: 0,
        fine_amount: 0,
        discount_amount: 0
      });

      const openAmount = computeOpenAmount(updatedAmount, 0);

      const status = computeStatus({
        due_date: installmentDueDate,
        paid_amount: 0,
        open_amount: openAmount
      });

      const res = await client.query(
        `
          INSERT INTO ${TB_DEBTS} (
            code,
            description,
            creditor_name,
            creditor_document,
            debt_type,
            category,
            cost_center,
            company_name,
            document_number,
            reference_number,
            issue_date,
            due_date,
            agreement_closed_at,
            first_installment_due_at,
            competence_month,
            competence_year,
            original_amount,
            interest_amount,
            fine_amount,
            discount_amount,
            updated_amount,
            paid_amount,
            open_amount,
            status,
            notes,
            is_installment,
            parent_debt_id,
            installment_number,
            installment_total,
            created_at,
            updated_at
          )
          VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
            $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
            $21,$22,$23,$24,$25,$26,$27,$28,$29,NOW(),NOW()
          )
          RETURNING *
        `,
        [
          baseData.code ? `${baseData.code}-${String(i).padStart(2, '0')}` : null,
          `${baseData.description} (${i}/${installments})`,
          baseData.creditor_name,
          baseData.creditor_document,
          baseData.debt_type,
          baseData.category,
          baseData.cost_center,
          baseData.company_name,
          baseData.document_number,
          baseData.reference_number,
          baseData.issue_date,
          installmentDueDate,
          baseData.agreement_closed_at,
          baseData.first_installment_due_at,
          baseData.competence_month,
          baseData.competence_year,
          installmentValue,
          0,
          0,
          0,
          updatedAmount,
          0,
          openAmount,
          status,
          baseData.notes,
          true,
          parentDebtId,
          i,
          installments
        ]
      );

      const row = res.rows[0];

      if (i === 1) {
        parentDebtId = row.id;

        await client.query(
          `
            UPDATE ${TB_DEBTS}
            SET parent_debt_id = id, updated_at = NOW()
            WHERE id = $1
          `,
          [row.id]
        );

        row.parent_debt_id = row.id;
      } else {
        row.parent_debt_id = parentDebtId;
      }

      generated.push(row);
    }

    await client.query('COMMIT');

    return {
      total_installments: installments,
      total_amount: totalAmount,
      parent_debt_id: parentDebtId,
      rows: generated
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
