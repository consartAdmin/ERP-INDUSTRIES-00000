// ╔════════════════════════════════════════════════════════════════════╗
// ║ accountsPayableCreateFromSource.repository.js — createFromSource   ║
// ║ Criação idempotente por origem (ex.: NF-e) + anexos em transação   ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB_FULL } from './accountsPayable.constants.js';
import { withTransaction, toNumber } from './accountsPayable.utils.js';
import { getBySource } from './accountsPayableQuery.repository.js';
import { listAttachments, addAttachments } from './accountsPayableAttachments.repository.js';

export async function createFromSource({
  supplier_id,
  invoice_number,
  issue_date,
  due_date,
  payment_method_id = null,
  description = null,
  category_id = null,
  subcategory_id = null,
  document_number = null,
  total_value = 0,
  amount_paid = 0,
  status = 'PENDING',
  notes = null,
  source_type,
  source_id,
  attachment_url = null,
  attachments = []
} = {}) {
  if (!source_type || source_id == null) {
    throw new Error('source_type and source_id are required');
  }

  const existing = await getBySource(source_type, source_id);
  if (existing) {
    const existingAttachments = await listAttachments(existing.id);
    return {
      created: false,
      payable: existing,
      attachments: existingAttachments
    };
  }

  return withTransaction(async (client) => {
    const insertSql = `
      INSERT INTO ${TB_FULL} (
        supplier_id,
        invoice_number,
        issue_date,
        due_date,
        payment_date,
        payment_method_id,
        description,
        category_id,
        subcategory_id,
        document_number,
        total_value,
        amount_paid,
        status,
        notes,
        attachment_url,
        source_type,
        source_id,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, NULL,
        $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14,
        $15, $16,
        NOW(), NOW()
      )
      RETURNING *
    `;

    const insertParams = [
      supplier_id,
      invoice_number || null,
      issue_date,
      due_date,
      payment_method_id,
      description,
      category_id,
      subcategory_id,
      document_number,
      toNumber(total_value, 0),
      toNumber(amount_paid, 0),
      status || 'PENDING',
      notes || null,
      attachment_url || null,
      source_type,
      source_id
    ];

    const inserted = await client.query(insertSql, insertParams);
    const payable = inserted.rows[0];

    const insertedAttachments = await addAttachments(
      payable.id,
      attachments,
      client
    );

    return {
      created: true,
      payable,
      attachments: insertedAttachments
    };
  });
}
