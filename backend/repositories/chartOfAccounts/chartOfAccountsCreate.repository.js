// ╔════════════════════════════════════════════════════════════════════╗
// ║ chartOfAccountsCreate.repository.js — create                       ║
// ╚════════════════════════════════════════════════════════════════════╝

import { COLUMNS, TABLE, WRITABLE_COLS } from './chartOfAccounts.constants.js';
import {
  httpError,
  mapDbError,
  normalizeBoolean,
  normalizeNullableText,
  normalizeRequiredText,
  normalizeType,
  normalizeNature,
  normalizeLevel,
  inferLevelFromCode,
  normalizeId,
} from './chartOfAccounts.sanitizers.js';
import { query } from './chartOfAccounts.utils.js';
import { ensureTable } from './chartOfAccountsSchema.repository.js';
import { existsByCode } from './chartOfAccountsGetById.repository.js';
import { validateParent } from './chartOfAccountsHierarchy.repository.js';

export async function create(payload = {}) {
  await ensureTable();

  const code = normalizeRequiredText(payload.code, 'code');

  const values = {
    code,
    description: normalizeRequiredText(payload.description, 'description'),
    account_type: normalizeType(payload.account_type),
    nature: normalizeNature(payload.nature),
    level: normalizeLevel(payload.level, inferLevelFromCode(code)),
    parent_account_id: normalizeId(payload.parent_account_id, 'parent_account_id', { allowNull: true }),
    allows_posting: normalizeBoolean(payload.allows_posting, COLUMNS.allows_posting.default),
    is_active: normalizeBoolean(payload.is_active, COLUMNS.is_active.default),
    notes: normalizeNullableText(payload.notes),
  };

  if (await existsByCode(code)) throw httpError('CODE_ALREADY_EXISTS', 409);

  await validateParent(values.parent_account_id);

  const placeholders = WRITABLE_COLS.map((_, idx) => `$${idx + 1}`).join(',');

  try {
    const { rows } = await query(
      `
        INSERT INTO ${TABLE} (
          ${WRITABLE_COLS.join(',\n          ')}
        )
        VALUES (${placeholders})
        RETURNING *
      `,
      WRITABLE_COLS.map((c) => values[c])
    );

    return rows[0];
  } catch (err) {
    throw mapDbError(err);
  }
}
