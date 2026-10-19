// ╔════════════════════════════════════════════════════════════════════╗
// ║ debts.sanitizers.js — Payload de entrada → dados da dívida         ║
// ╚════════════════════════════════════════════════════════════════════╝

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

export function mapDebtPayload(payload = {}) {
  const originalAmount = roundMoney(payload.original_amount);
  const interestAmount = roundMoney(payload.interest_amount);
  const fineAmount = roundMoney(payload.fine_amount);
  const discountAmount = roundMoney(payload.discount_amount);
  const paidAmount = roundMoney(payload.paid_amount);

  const updatedAmount = computeUpdatedAmount({
    original_amount: originalAmount,
    interest_amount: interestAmount,
    fine_amount: fineAmount,
    discount_amount: discountAmount
  });

  const openAmount = computeOpenAmount(updatedAmount, paidAmount);

  const dueDate =
    normalizeDate(payload.due_date) ||
    normalizeDate(payload.first_installment_due_at) ||
    buildFirstDueDateFromIssue(payload.issue_date, payload.due_day);

  const status =
    safeText(payload.status, 30) ||
    computeStatus({
      due_date: dueDate,
      paid_amount: paidAmount,
      open_amount: openAmount
    });

  return {
    code: safeText(payload.code, 30),
    description: safeText(payload.description, 255),
    creditor_name: safeText(payload.creditor_name, 200),
    creditor_document: safeText(payload.creditor_document, 20),
    debt_type: safeText(payload.debt_type, 50),
    category: safeText(payload.category, 100),
    cost_center: safeText(payload.cost_center, 100),
    company_name: safeText(payload.company_name, 150),
    document_number: safeText(payload.document_number, 50),
    reference_number: safeText(payload.reference_number, 50),

    issue_date: normalizeDate(payload.issue_date),
    due_date: dueDate,
    agreement_closed_at: normalizeDate(payload.agreement_closed_at),
    first_installment_due_at: normalizeDate(payload.first_installment_due_at),
    competence_month: normalizeMonth(payload.competence_month),
    competence_year: normalizeYear(payload.competence_year),

    original_amount: originalAmount,
    interest_amount: interestAmount,
    fine_amount: fineAmount,
    discount_amount: discountAmount,
    updated_amount: updatedAmount,
    paid_amount: paidAmount,
    open_amount: openAmount,

    status,
    notes: safeText(payload.notes, 5000),

    is_installment: Boolean(payload.is_installment),
    parent_debt_id: payload.parent_debt_id ? Number(payload.parent_debt_id) : null,
    installment_number: payload.installment_number ? Number(payload.installment_number) : null,
    installment_total: payload.installment_total ? Number(payload.installment_total) : null,
    due_day: payload.due_day ? Number(payload.due_day) : null
  };
}
