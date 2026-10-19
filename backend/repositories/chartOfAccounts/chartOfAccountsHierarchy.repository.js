// ╔════════════════════════════════════════════════════════════════════╗
// ║ chartOfAccountsHierarchy.repository.js — hierarquia de contas      ║
// ║ validateParent, getDescendantIds, hasChildren, getTree,            ║
// ║ getFlatHierarchy                                                   ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TABLE, PK, ALL_COLS } from './chartOfAccounts.constants.js';
import { httpError, normalizeId, normalizeBoolean } from './chartOfAccounts.sanitizers.js';
import { query } from './chartOfAccounts.utils.js';
import { ensureTable } from './chartOfAccountsSchema.repository.js';
import { getById } from './chartOfAccountsGetById.repository.js';

export async function validateParent(parentAccountId, currentId = null) {
  if (parentAccountId === null) return null;

  const parent = await getById(parentAccountId);
  if (!parent) throw httpError('PARENT_ACCOUNT_NOT_FOUND', 404);

  if (currentId && Number(parent[PK]) === Number(currentId)) {
    throw httpError('ACCOUNT_CANNOT_BE_ITS_OWN_PARENT', 400);
  }

  if (currentId) {
    const descendantIds = await getDescendantIds(currentId);
    if (descendantIds.includes(Number(parentAccountId))) {
      throw httpError('CIRCULAR_HIERARCHY_NOT_ALLOWED', 400);
    }
  }

  return parent;
}

export async function getDescendantIds(accountId) {
  await ensureTable();

  const safeId = normalizeId(accountId, 'account_id');

  const { rows } = await query(
    `
      WITH RECURSIVE descendants AS (
        SELECT ${PK}, parent_account_id
        FROM ${TABLE}
        WHERE parent_account_id = $1

        UNION ALL

        SELECT child.${PK}, child.parent_account_id
        FROM ${TABLE} child
        INNER JOIN descendants d
          ON d.${PK} = child.parent_account_id
      )
      SELECT ${PK}
      FROM descendants
    `,
    [safeId]
  );

  return rows.map((r) => Number(r[PK]));
}

export async function hasChildren(id) {
  await ensureTable();

  const safeId = normalizeId(id, 'id');

  const { rowCount } = await query(
    `SELECT 1 FROM ${TABLE} WHERE parent_account_id = $1 LIMIT 1`,
    [safeId]
  );

  return rowCount > 0;
}

export async function getTree({ is_active = null } = {}) {
  await ensureTable();

  const safeIsActive = normalizeBoolean(is_active, null);

  const params = [];
  let whereSql = '';

  if (safeIsActive !== null) {
    params.push(safeIsActive);
    whereSql = `WHERE coa.is_active = $1`;
  }

  const { rows } = await query(
    `
      SELECT
        ${ALL_COLS.map((c) => `coa.${c}`).join(',\n        ')}
      FROM ${TABLE} coa
      ${whereSql}
      ORDER BY coa.code ASC, coa.${PK} ASC
    `,
    params
  );

  const byId = new Map();
  const roots = [];

  for (const row of rows) {
    byId.set(row[PK], { ...row, children: [] });
  }

  for (const row of rows) {
    const node = byId.get(row[PK]);
    if (row.parent_account_id && byId.has(row.parent_account_id)) {
      byId.get(row.parent_account_id).children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export async function getFlatHierarchy({ is_active = null } = {}) {
  const tree = await getTree({ is_active });
  const result = [];

  function walk(nodes, depth = 0) {
    for (const node of nodes) {
      result.push({
        ...node,
        depth,
        label: `${'— '.repeat(depth)}${node.code} - ${node.description}`,
      });
      if (Array.isArray(node.children) && node.children.length) {
        walk(node.children, depth + 1);
      }
    }
  }

  walk(tree, 0);
  return result;
}
