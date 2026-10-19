// ╔════════════════════════════════════════════════════════════════════╗
// ║ chartOfAccountsRemove.repository.js — remove (soft/hard)           ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TABLE, PK } from './chartOfAccounts.constants.js';
import { httpError, normalizeId } from './chartOfAccounts.sanitizers.js';
import { query } from './chartOfAccounts.utils.js';
import { ensureTable } from './chartOfAccountsSchema.repository.js';
import { getById } from './chartOfAccountsGetById.repository.js';
import { hasChildren } from './chartOfAccountsHierarchy.repository.js';

/**
 * Soft delete by default (is_active = FALSE).
 * Hard delete note: per the catalog, every table referencing chartOfAccounts
 * (accountsReceivable, cashMoviments, suppliers) uses ON DELETE SET NULL,
 * so their chart_account_id is silently cleared.
 */
export async function remove(id, { hardDelete = false } = {}) {
  await ensureTable();

  const safeId = normalizeId(id, 'id');
  const current = await getById(safeId);

  if (!current) throw httpError('ACCOUNT_NOT_FOUND', 404);

  const childExists = await hasChildren(safeId);
  if (childExists) throw httpError('ACCOUNT_HAS_CHILDREN', 409);

  if (hardDelete === true) {
    const { rowCount } = await query(`DELETE FROM ${TABLE} WHERE ${PK} = $1`, [safeId]);
    return { deleted: rowCount > 0, mode: 'hard' };
  }

  const { rowCount } = await query(
    `
      UPDATE ${TABLE}
      SET is_active = FALSE, updated_at = NOW()
      WHERE ${PK} = $1
    `,
    [safeId]
  );

  return { deleted: rowCount > 0, mode: 'soft' };
}
