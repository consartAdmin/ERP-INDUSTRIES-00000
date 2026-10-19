// ╔════════════════════════════════════════════════════════════════════╗
// ║ expenseEntriesRemove.repository.js — remove                        ║
// ║ Tabela: public."expenseEntries" (bloqueia POSTED)                  ║
// ╚════════════════════════════════════════════════════════════════════╝

import { q } from './expenseEntries.sql.js';

export async function remove({ expenseEntryId }) {
  const id = Number(expenseEntryId);
  if (!id) throw new Error('expenseEntryId is required');

  // regra: não remover POSTED (segurança)
  const current = await q(`SELECT status FROM public."expenseEntries" WHERE expenseentryid = $1 LIMIT 1`, [id]);
  const st = String(current.rows?.[0]?.status || '').toUpperCase();
  if (st === 'POSTED') throw new Error('Entrada POSTED não pode ser excluída.');

  const sql = `
      DELETE FROM public."expenseEntries"
      WHERE expenseentryid = $1
      RETURNING expenseentryid
    `;
  const res = await q(sql, [id]);
  return res.rows?.[0] || null;
}
