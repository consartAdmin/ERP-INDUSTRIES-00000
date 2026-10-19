// ╔══════════════════════════════════════════════════════════════════════╗
// ║ update.repository.js — CONSART ERP | Notas Fiscais Emitidas          ║
// ║ Atualização parcial em transação, com lock e auditoria               ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  TB_INVOICES,
  INVOICES_ISSUED_UPDATE_COLUMNS,
  INVOICES_ISSUED_PRIMARY_KEY,
  createAuditLog,
  normalizeMoney,
  normalizeText,
  normalizeUserId,
  withTransaction,
  rowToInvoice,
} from './_shared.js';

export async function update(
  invoiceId,
  patch = {},
  { userId = null, operation = 'UPDATE' } = {}
) {
  const id = Number(invoiceId);
  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false, error: 'invoice_id inválido' };
  }

  const allowed = {};

  for (const column of INVOICES_ISSUED_UPDATE_COLUMNS) {
    if (Object.prototype.hasOwnProperty.call(patch, column)) {
      allowed[column] = patch[column];
    }
  }

  const sets = [];
  const args = [];
  let ai = 1;

  for (const [key, value] of Object.entries(allowed)) {
    if (value !== undefined) {
      sets.push(`${key} = $${ai++}`);

      if (key === 'total_amount') {
        args.push(normalizeMoney(value, 0));
      } else if (
        [
          'nfe_key',
          'nfe_provider_id',
          'nfe_status',
          'nfe_protocol',
          'nfe_environment',
          'xml_url',
          'danfe_url',
          'cancellation_reason',
          'source_type',
          'customer_name',
          'customer_tax_id',
          'customer_email',
        ].includes(key)
      ) {
        args.push(normalizeText(value));
      } else {
        args.push(value);
      }
    }
  }

  if (!sets.length) {
    return { ok: false, error: 'Nenhum campo para atualizar' };
  }

  args.push(id);

  const sql = `
    UPDATE ${TB_INVOICES}
    SET ${sets.join(', ')}, updated_at = NOW()
    WHERE "${INVOICES_ISSUED_PRIMARY_KEY}" = $${ai}
    RETURNING *
  `;

  const result = await withTransaction(async (client) => {
    const beforeRes = await client.query(
      `SELECT * FROM ${TB_INVOICES} WHERE "${INVOICES_ISSUED_PRIMARY_KEY}" = $1 FOR UPDATE`,
      [id]
    );

    if (!beforeRes.rows.length) return null;

    const { rows } = await client.query(sql, args);
    const after = rows[0];

    await createAuditLog({
      tabela: 'invoicesIssued',
      register_id: id,
      operation: String(operation || 'UPDATE').toUpperCase(),
      user_id: normalizeUserId(userId),
      before: rowToInvoice(beforeRes.rows[0]),
      after: rowToInvoice(after),
      db: client,
    });

    return after;
  });

  if (!result) return { ok: false, error: 'NOT_FOUND' };

  return {
    ok: true,
    invoice: rowToInvoice(result),
  };
}

export default update;
