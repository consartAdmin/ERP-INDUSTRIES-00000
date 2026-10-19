// ╔════════════════════════════════════════════════════════════════════╗
// ║ chartOfAccountsUpdate.repository.js — update / setActive           ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TABLE, PK, WRITABLE_COLS } from './chartOfAccounts.constants.js';
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
import { getById, existsByCode } from './chartOfAccountsGetById.repository.js';
import { validateParent } from './chartOfAccountsHierarchy.repository.js';

export async function update(id, payload = {}) {
  await ensureTable();

  const safeId = normalizeId(id, 'id');
  const current = await getById(safeId);

  if (!current) throw httpError('ACCOUNT_NOT_FOUND', 404);

  const code = payload.code !== undefined
    ? normalizeRequiredText(payload.code, 'code')
    : current.code;

  const values = {
    code,

    description: payload.description !== undefined
      ? normalizeRequiredText(payload.description, 'description')
      : current.description,

    account_type: payload.account_type !== undefined
      ? normalizeType(payload.account_type)
      : current.account_type,

    nature: payload.nature !== undefined
      ? normalizeNature(payload.nature)
      : current.nature,

    level: payload.level !== undefined
      ? normalizeLevel(payload.level, inferLevelFromCode(code))
      : (current.level || inferLevelFromCode(code)),

    parent_account_id: payload.parent_account_id !== undefined
      ? normalizeId(payload.parent_account_id, 'parent_account_id', { allowNull: true })
      : current.parent_account_id,

    allows_posting: payload.allows_posting !== undefined
      ? normalizeBoolean(payload.allows_posting, true)
      : current.allows_posting,

    is_active: payload.is_active !== undefined
      ? normalizeBoolean(payload.is_active, true)
      : current.is_active,

    notes: payload.notes !== undefined
      ? normalizeNullableText(payload.notes)
      : current.notes,
  };

  if (await existsByCode(code, safeId)) throw httpError('CODE_ALREADY_EXISTS', 409);

  await validateParent(values.parent_account_id, safeId);

  const sets = WRITABLE_COLS.map((c, idx) => `${c} = $${idx + 1}`);

  try {
    const { rows } = await query(
      `
        UPDATE ${TABLE}
        SET
          ${sets.join(',\n          ')},
          updated_at = NOW()
        WHERE ${PK} = $${WRITABLE_COLS.length + 1}
        RETURNING *
      `,
      [...WRITABLE_COLS.map((c) => values[c]), safeId]
    );

    return rows[0];
  } catch (err) {
    throw mapDbError(err);
  }
}

export async function setActive(id, isActive) {
  await ensureTable();

  const safeId = normalizeId(id, 'id');
  const current = await getById(safeId);

  if (!current) throw httpError('ACCOUNT_NOT_FOUND', 404);

  const safeActive = normalizeBoolean(isActive, null);
  if (safeActive === null) throw httpError('INVALID_IS_ACTIVE', 400);

  const { rows } = await query(
    `
      UPDATE ${TABLE}
      SET is_active = $1, updated_at = NOW()
      WHERE ${PK} = $2
      RETURNING *
    `,
    [safeActive, safeId]
  );

  return rows[0];
}
