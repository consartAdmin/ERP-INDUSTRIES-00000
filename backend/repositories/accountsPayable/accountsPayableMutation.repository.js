// ╔════════════════════════════════════════════════════════════════════╗
// ║ accountsPayableMutation.repository.js — create / update / remove   ║
// ║ Tabela: public."accountsPayable"                                   ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB_FULL } from './accountsPayable.constants.js';
import { q, toNumber } from './accountsPayable.utils.js';

export async function create(payload) {
  const {
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
    source_id
  } = payload || {};

  const sql = `
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
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15,
      $16, $17,
      NOW(), NOW()
    )
    RETURNING *
  `;

  const params = [
    supplier_id,
    invoice_number || null,
    issue_date,
    due_date,
    payment_date || null,
    payment_method_id || null,
    description || null,
    category_id || null,
    subcategory_id || null,
    document_number || null,
    toNumber(total_value, 0),
    toNumber(amount_paid, 0),
    status || 'PENDING',
    notes || null,
    attachment_url || null,
    source_type || null,
    source_id ?? null
  ];

  const res = await q(sql, params);
  return res.rows[0];
}

export async function update(id, payload) {
  const {
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
    attachment_url
  } = payload || {};

  const sql = `
    UPDATE ${TB_FULL}
    SET
      supplier_id       = $1,
      invoice_number    = $2,
      issue_date        = $3,
      due_date          = $4,
      payment_date      = $5,
      payment_method_id = $6,
      description       = $7,
      category_id       = $8,
      subcategory_id    = $9,
      document_number   = $10,
      total_value       = $11,
      amount_paid       = $12,
      status            = $13,
      notes             = $14,
      attachment_url    = $15,
      updated_at        = NOW()
    WHERE id = $16
    RETURNING *
  `;

  const params = [
    supplier_id,
    invoice_number || null,
    issue_date,
    due_date,
    payment_date || null,
    payment_method_id || null,
    description || null,
    category_id || null,
    subcategory_id || null,
    document_number || null,
    toNumber(total_value, 0),
    toNumber(amount_paid, 0),
    status || 'PENDING',
    notes || null,
    attachment_url || null,
    id
  ];

  const res = await q(sql, params);
  if (!res.rowCount) return null;
  return res.rows[0];
}

export async function remove(id) {
  const sql = `DELETE FROM ${TB_FULL} WHERE id = $1`;
  const res = await q(sql, [id]);
  return res.rowCount > 0;
}
