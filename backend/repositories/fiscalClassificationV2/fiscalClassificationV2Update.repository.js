// ╔════════════════════════════════════════════════════════════════════╗
// ║ fiscalClassificationV2Update.repository.js — update / setActive    ║
// ║ Tabela: public."fiscalClassificationV2"                            ║
// ╚════════════════════════════════════════════════════════════════════╝

import db from '../../config/db.js';
import {
  FISCAL_CLASSIFICATION_V2_TABLE as TABLE,
  FISCAL_CLASSIFICATION_V2_PRIMARY_KEY as PRIMARY_KEY,
  prepareFiscalClassificationUpdate,
} from './fiscalClassificationV2.catalog.js';
import { RETURNING } from './fiscalClassificationV2.sql.js';
import { parseBoolean, writableEntries } from './fiscalClassificationV2.sanitizers.js';

// updated_at is maintained by fiscal_classification_v2_updated_at.
export async function update(id, payload = {}) {
  const entries = writableEntries(prepareFiscalClassificationUpdate(payload));
  const set = entries.map(([key], index) => `"${key}" = $${index + 1}`).join(', ');
  const values = entries.map(([, value]) => value);
  const sql = `
    UPDATE ${TABLE}
    SET ${set}
    WHERE ${PRIMARY_KEY} = $${values.length + 1}
    RETURNING ${RETURNING}
  `;
  return (await db.query(sql, [...values, id])).rows[0] ?? null;
}

export async function setActive(id, isActive) {
  const active = parseBoolean(isActive, 'isActive');
  return (await db.query(
    `UPDATE ${TABLE}
     SET is_active = $1
     WHERE ${PRIMARY_KEY} = $2
     RETURNING ${RETURNING}`,
    [active, id],
  )).rows[0] ?? null;
}
