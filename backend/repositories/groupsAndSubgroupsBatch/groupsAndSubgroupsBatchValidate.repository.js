// ╔════════════════════════════════════════════════════════════════════╗
// ║ groupsAndSubgroupsBatchValidate.repository.js — subgrupo pertence ao grupo ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_SUBGROUPS } from './groupsAndSubgroupsBatch.constants.js';
import { toInt } from './groupsAndSubgroupsBatch.sanitizers.js';
import { tableExists, columnExists } from './groupsAndSubgroupsBatchIntrospection.repository.js';

// -----------------------------------------------------------------------------
// Internal validation: subgroup belongs to group (best-effort)
// -----------------------------------------------------------------------------
export async function validateSubgroupBelongsToGroup({ product_group_id, product_subgroup_id }) {
  if (!Number.isInteger(product_subgroup_id)) return { ok: true, skipped: true };

  const hasSubgroupsTable = await tableExists(TB_SUBGROUPS).catch(() => false);
  if (!hasSubgroupsTable) return { ok: true, skipped: true };

  const hasIsActive = await columnExists(TB_SUBGROUPS, 'is_active').catch(() => false);

  const groupColCandidates = ['product_group_id', 'group_id', 'products_group_id', 'productGroupId'];
  let groupCol = null;
  for (const c of groupColCandidates) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await columnExists(TB_SUBGROUPS, c).catch(() => false);
    if (ok) { groupCol = c; break; }
  }

  const selectCols = [
    'product_subgroup_id',
    ...(groupCol ? [groupCol] : []),
    ...(hasIsActive ? ['is_active'] : []),
  ].join(', ');

  const sgRes = await pool.query(
    `
      SELECT ${selectCols}
      FROM ${TB_SUBGROUPS}
      WHERE product_subgroup_id = $1
      LIMIT 1;
    `,
    [product_subgroup_id],
  );

  if (!sgRes.rowCount) {
    const err = new Error('Subgroup not found.');
    err.status = 404;
    throw err;
  }

  const row = sgRes.rows[0];

  if (hasIsActive && row?.is_active === false) {
    const err = new Error('Cannot assign an inactive subgroup.');
    err.status = 409;
    throw err;
  }

  if (groupCol) {
    const subgroupGroupId = toInt(row[groupCol], null);
    if (Number.isInteger(subgroupGroupId) && subgroupGroupId !== product_group_id) {
      const err = new Error('Subgroup does not belong to the provided group.');
      err.status = 409;
      throw err;
    }
  }

  return { ok: true, skipped: false, groupCol, hasIsActive };
}
