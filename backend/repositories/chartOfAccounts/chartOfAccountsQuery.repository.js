// ╔════════════════════════════════════════════════════════════════════╗
// ║ chartOfAccountsQuery.repository.js — list / search /               ║
// ║ listPostingAccounts                                                ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TABLE, PK, SEARCH_COLS, POSTING_COLS, SORT_MAP } from './chartOfAccounts.constants.js';
import { FULL_SELECT } from './chartOfAccounts.sql.js';
import {
  normalizePaging,
  normalizeBoolean,
  normalizeType,
  normalizeNature,
  normalizeId,
} from './chartOfAccounts.sanitizers.js';
import { query } from './chartOfAccounts.utils.js';
import { ensureTable } from './chartOfAccountsSchema.repository.js';

export async function list(filters = {}) {
  await ensureTable();

  const {
    page = 1,
    limit = 20,
    search = '',
    account_type = '',
    nature = '',
    parent_account_id = '',
    allows_posting = '',
    is_active = '',
    only_posting = '',
    sort_by = 'code',
    sort_order = 'asc',
  } = filters || {};

  const { safePage, safeLimit, offset } = normalizePaging(page, limit);

  const where = [];
  const params = [];
  let i = 1;

  const safeSearch = String(search || '').trim();
  if (safeSearch) {
    where.push(`(
      coa.code ILIKE $${i}
      OR coa.description ILIKE $${i}
      OR COALESCE(coa.notes, '') ILIKE $${i}
    )`);
    params.push(`%${safeSearch}%`);
    i++;
  }

  if (String(account_type || '').trim()) {
    where.push(`coa.account_type = $${i}`);
    params.push(normalizeType(account_type));
    i++;
  }

  if (String(nature || '').trim()) {
    where.push(`coa.nature = $${i}`);
    params.push(normalizeNature(nature));
    i++;
  }

  if (parent_account_id !== '' && parent_account_id !== undefined && parent_account_id !== null) {
    if (String(parent_account_id).trim().toLowerCase() === 'null') {
      where.push(`coa.parent_account_id IS NULL`);
    } else {
      where.push(`coa.parent_account_id = $${i}`);
      params.push(normalizeId(parent_account_id, 'parent_account_id'));
      i++;
    }
  }

  const safeAllowsPosting = normalizeBoolean(allows_posting, null);
  if (safeAllowsPosting !== null) {
    where.push(`coa.allows_posting = $${i}`);
    params.push(safeAllowsPosting);
    i++;
  }

  const safeOnlyPosting = normalizeBoolean(only_posting, null);
  if (safeOnlyPosting === true) {
    where.push(`coa.allows_posting = TRUE`);
  }

  const safeIsActive = normalizeBoolean(is_active, null);
  if (safeIsActive !== null) {
    where.push(`coa.is_active = $${i}`);
    params.push(safeIsActive);
    i++;
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const orderBy = SORT_MAP[String(sort_by || '').trim()] || 'coa.code';
  const orderDir = String(sort_order || '').trim().toLowerCase() === 'desc' ? 'DESC' : 'ASC';

  const countResult = await query(
    `
      SELECT COUNT(*)::INT AS total
      FROM ${TABLE} coa
      ${whereSql}
    `,
    params
  );

  const total = countResult.rows[0]?.total || 0;

  params.push(safeLimit, offset);

  const { rows } = await query(
    `
      SELECT
        ${FULL_SELECT}
      FROM ${TABLE} coa
      LEFT JOIN ${TABLE} parent
        ON parent.${PK} = coa.parent_account_id
      ${whereSql}
      ORDER BY ${orderBy} ${orderDir}, coa.${PK} ASC
      LIMIT $${i} OFFSET $${i + 1}
    `,
    params
  );

  return {
    data: rows,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.max(Math.ceil(total / safeLimit), 1),
    },
  };
}

export async function search(queryText, limit = 20) {
  await ensureTable();

  const q = String(queryText || '').trim();
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);

  const { rows } = await query(
    `
      SELECT
        ${SEARCH_COLS.map((c) => `coa.${c}`).join(',\n        ')}
      FROM ${TABLE} coa
      WHERE (
        $1 = ''
        OR coa.code ILIKE $2
        OR coa.description ILIKE $2
        OR COALESCE(coa.notes, '') ILIKE $2
      )
      ORDER BY coa.code ASC
      LIMIT $3
    `,
    [q, `%${q}%`, safeLimit]
  );

  return rows;
}

export async function listPostingAccounts({ is_active = true, search = '', limit = 100 } = {}) {
  await ensureTable();

  const safeActive = normalizeBoolean(is_active, true);
  const safeSearch = String(search || '').trim();
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);

  const { rows } = await query(
    `
      SELECT
        ${POSTING_COLS.join(',\n        ')}
      FROM ${TABLE}
      WHERE allows_posting = TRUE
        AND ($1::BOOLEAN IS NULL OR is_active = $1)
        AND (
          $2 = ''
          OR code ILIKE $3
          OR description ILIKE $3
        )
      ORDER BY code ASC
      LIMIT $4
    `,
    [safeActive, safeSearch, `%${safeSearch}%`, safeLimit]
  );

  return rows;
}
