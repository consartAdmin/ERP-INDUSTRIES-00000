// ╔════════════════════════════════════════════════════════════════════╗
// ║ debtsUpdate.repository.js — update (+ recálculo em transação)      ║
// ║ Tabela: public.debts                                               ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_DEBTS } from './debts.constants.js';
import { mapDebtPayload } from './debts.sanitizers.js';
import { getById } from './debtsQuery.repository.js';
import { recalcDebtById } from './debtsRecalc.repository.js';

export async function update(id, payload = {}) {
  const current = await getById(id);
  if (!current) throw new Error('Dívida não encontrada.');

  const merged = {
    ...current,
    ...payload
  };

  const data = mapDebtPayload(merged);

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

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `
        UPDATE ${TB_DEBTS}
        SET
          code = $2,
          description = $3,
          creditor_name = $4,
          creditor_document = $5,
          debt_type = $6,
          category = $7,
          cost_center = $8,
          company_name = $9,
          document_number = $10,
          reference_number = $11,
          issue_date = $12,
          due_date = $13,
          agreement_closed_at = $14,
          first_installment_due_at = $15,
          competence_month = $16,
          competence_year = $17,
          original_amount = $18,
          interest_amount = $19,
          fine_amount = $20,
          discount_amount = $21,
          notes = $22,
          is_installment = $23,
          parent_debt_id = $24,
          installment_number = $25,
          installment_total = $26,
          updated_at = NOW()
        WHERE id = $1
      `,
      [
        id,
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
        data.notes,
        data.is_installment,
        data.parent_debt_id,
        data.installment_number,
        data.installment_total
      ]
    );

    const debt = await recalcDebtById(id, client);

    await client.query('COMMIT');
    return debt;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
