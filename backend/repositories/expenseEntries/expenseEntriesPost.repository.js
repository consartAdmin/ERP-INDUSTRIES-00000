// ╔════════════════════════════════════════════════════════════════════╗
// ║ expenseEntriesPost.repository.js — post (POSTAR / FINALIZAR)       ║
// ║ status → POSTED + UPSERT em public."accountsPayable" (transação)   ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { q, SELECT_ALIASED } from './expenseEntries.sql.js';
import { toISODateOnly } from './expenseEntries.utils.js';
import { resolveSupplierId } from './expenseEntriesSupplier.repository.js';

/**
 * POSTAR / FINALIZAR entrada:
 * - status -> POSTED
 * - cria/atualiza accountsPayable vinculado (idempotente)
 *
 * POST /api/expense-entries/:id/post
 * body opcional: { dueDate: 'YYYY-MM-DD' }
 */
export async function post({ expenseEntryId, dueDate = null } = {}) {
  const id = Number(expenseEntryId);
  if (!id) throw new Error('expenseEntryId is required');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // lock do registro
    const cur = await client.query(`
        ${SELECT_ALIASED}
        WHERE expenseentryid = $1
        LIMIT 1
        FOR UPDATE
      `, [id]);

    if (!cur.rowCount) throw new Error('Not found');

    const row = cur.rows[0];

    const statusNow = String(row.status || 'OPEN').toUpperCase();
    if (statusNow === 'CANCELED') throw new Error('Não é possível postar entrada CANCELED.');
    if (statusNow === 'POSTED') {
      // idempotente: só garante que existe o payable e retorna
    } else {
      await client.query(`
          UPDATE public."expenseEntries"
          SET status = 'POSTED', updatedat = NOW()
          WHERE expenseentryid = $1
        `, [id]);
      row.status = 'POSTED';
    }

    const issueDate = toISODateOnly(row.issueDate);
    if (!issueDate) throw new Error('issueDate is required');

    const finalDue = toISODateOnly(dueDate) || issueDate;

    // resolve supplier_id (accountsPayable exige NOT NULL)
    const supplier_id = await resolveSupplierId(client, {
      tax_id: row.supplierDocument,
      name: row.supplierName,
    });

    const total = Number(row.totalExpenseValue || 0);
    const invoice_number = row.documentNumber || null;

    const docKey = row.documentKey || null;
    const docSeries = row.documentSeries || null;

    const description =
      `DESPESA (INBOUND) ${(row.documentType || 'NFE').toUpperCase()} ` +
      `${invoice_number || '-'}${docSeries ? '/' + docSeries : ''}` +
      (docKey ? ` • CHAVE ${docKey}` : '');

    const notesBase = String(row.notes || '').trim();
    const notes = (notesBase ? notesBase + '\n' : '') + `[origem] expenseEntryId=${id}`;

    // ✅ UPSERT idempotente por source_type/source_id
    // ⚠️ NÃO inclui balance (GENERATED ALWAYS)
    const apSql = `
        INSERT INTO public."accountsPayable" (
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
          NULL, $5, NULL, NULL, $6,
          $7, 0, 'PENDING', $8, NULL,
          'EXPENSE_ENTRY', $9,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT (source_type, source_id)
        DO UPDATE SET
          supplier_id     = EXCLUDED.supplier_id,
          invoice_number  = EXCLUDED.invoice_number,
          issue_date      = EXCLUDED.issue_date,
          due_date        = EXCLUDED.due_date,
          description     = EXCLUDED.description,
          document_number = EXCLUDED.document_number,
          total_value     = EXCLUDED.total_value,
          notes           = EXCLUDED.notes,
          updated_at      = CURRENT_TIMESTAMP
        RETURNING id, supplier_id, invoice_number, issue_date, due_date, total_value, amount_paid, balance, status
      `;

    const apParams = [
      supplier_id,
      invoice_number,
      issueDate,
      finalDue,
      description,
      (docKey || invoice_number || null),
      total,
      notes,
      id,
    ];

    const apRes = await client.query(apSql, apParams);
    const accountsPayable = apRes.rows?.[0] || null;

    await client.query('COMMIT');

    const refreshed = await q(`
        ${SELECT_ALIASED}
        WHERE expenseentryid = $1
        LIMIT 1
      `, [id]);

    return {
      ok: true,
      expenseEntry: refreshed.rows?.[0] || { ...row, status: 'POSTED' },
      accountsPayable,
    };
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    throw e;
  } finally {
    client.release();
  }
}
