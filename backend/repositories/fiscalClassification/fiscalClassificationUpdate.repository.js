// ╔════════════════════════════════════════════════════════════════════╗
// ║ fiscalClassificationUpdate.repository.js — update                  ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './fiscalClassification.constants.js';
import { toNumOrNull, toBool } from './fiscalClassification.sanitizers.js';
import { normalizeRow } from './fiscalClassification.mappers.js';

export async function update(id, payload = {}) {
  const sets = [];
  const vals = [];
  let i = 1;

  const add = (col, v) => {
    sets.push(`${col} = $${i++}`);
    vals.push(v);
  };

  if (payload.classification_name !== undefined) add('classification_name', payload.classification_name);
  if (payload.description !== undefined)        add('description', payload.description ?? null);
  if (payload.ncm_code !== undefined)           add('ncm_code', payload.ncm_code ?? null);
  if (payload.cest_code !== undefined)          add('cest_code', payload.cest_code ?? null);
  if (payload.ncm_description !== undefined)    add('ncm_description', payload.ncm_description ?? null);
  if (payload.cest_description !== undefined)   add('cest_description', payload.cest_description ?? null);
  if (payload.fiscal_profile_id !== undefined)  add('fiscal_profile_id', toNumOrNull(payload.fiscal_profile_id));
  if (payload.is_active !== undefined)          add('is_active', toBool(payload.is_active));

  add('updated_at', new Date());

  const sql = `
    UPDATE ${TB}
    SET ${sets.join(', ')}
    WHERE fiscal_classification_id = $${i}
    RETURNING *;
  `;
  vals.push(Number(id));

  const { rows } = await pool.query(sql, vals);
  return rows[0] ? normalizeRow(rows[0]) : null;
}
