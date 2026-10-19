// ╔══════════════════════════════════════════════════════════════════════╗
// ║ remove.repository.js — CONSART ERP | Notas Fiscais Emitidas          ║
// ║ Exclui a NF-e em transação, registrando o estado anterior            ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  TB_INVOICES,
  createAuditLog,
  normalizeUserId,
  withTransaction,
  rowToInvoice,
} from './_shared.js';

export async function remove(invoiceId, { userId = null } = {}) {
  const id = Number(invoiceId);
  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false, error: 'invoice_id inválido' };
  }

  const deletedInvoice = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `DELETE FROM ${TB_INVOICES} WHERE invoice_id = $1 RETURNING *`,
      [id]
    );

    if (!rows.length) return null;

    await createAuditLog({
      tabela: 'invoicesIssued',
      register_id: id,
      operation: 'DELETE',
      user_id: normalizeUserId(userId),
      before: rowToInvoice(rows[0]),
      after: null,
      db: client,
    });

    return rows[0];
  });

  return {
    ok: true,
    deleted: deletedInvoice ? 1 : 0,
  };
}

export default remove;
