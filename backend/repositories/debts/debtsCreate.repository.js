// ╔════════════════════════════════════════════════════════════════════╗
// ║ debtsCreate.repository.js — create (dívida única)                  ║
// ║ Tabela: public.debts                                               ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_DEBTS } from './debts.constants.js';
import { mapDebtPayload } from './debts.sanitizers.js';

export async function create(payload = {}) {
  const data = mapDebtPayload(payload);

  if (!data.description) {
    throw new Error('description é obrigatório.');
  }

  if (!data.debt_type) {
    throw new Error('debt_type é obrigatório.');
  }

  if (!data.due_date) {
    throw new Error('due_date é obrigatório.');
  }

  if (data.original_amount <= 0) {
    throw new Error('original_amount deve ser maior que zero.');
  }

  const res = await pool.query(
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
      data.code,
      data.description,
      data.creditor_name,
      data.creditor_document,
      data.debt_type,
      data.category,
      data.cost_center,
      data.company_name,
      data.document_number,
      data.reference_number,
      data.issue_date,
      data.due_date,
      data.agreement_closed_at,
      data.first_installment_due_at,
      data.competence_month,
      data.competence_year,
      data.original_amount,
      data.interest_amount,
      data.fine_amount,
      data.discount_amount,
      data.updated_amount,
      data.paid_amount,
      data.open_amount,
      data.status,
      data.notes,
      data.is_installment,
      data.parent_debt_id,
      data.installment_number,
      data.installment_total
    ]
  );

  return res.rows[0];
}
