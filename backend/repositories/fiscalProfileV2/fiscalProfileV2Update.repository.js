// ╔════════════════════════════════════════════════════════════════════╗
// ║ fiscalProfileV2Update.repository.js — update / setActive           ║
// ║ Tabela: public."fiscalProfileV2"                                   ║
// ╚════════════════════════════════════════════════════════════════════╝

import db from '../../config/db.js';
import {
  FISCAL_PROFILE_V2_TABLE as TABLE,
  FISCAL_PROFILE_V2_PRIMARY_KEY as PRIMARY_KEY,
  prepareFiscalProfileUpdate,
} from './fiscalProfileV2.catalog.js';
import { RETURNING } from './fiscalProfileV2.sql.js';
import { parseBoolean, writableEntries } from './fiscalProfileV2.sanitizers.js';

// updated_at is maintained by the fiscal_profile_v2_updated_at trigger.
export async function update(id, payload = {}) {
  const entries = writableEntries(prepareFiscalProfileUpdate(payload));
  const set = entries
    .map(([key], index) => `"${key}" = $${index + 1}`)
    .join(', ');
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

  const sql = `
    UPDATE ${TABLE}
    SET is_active = $1
    WHERE ${PRIMARY_KEY} = $2
    RETURNING ${RETURNING}
  `;

  return (await db.query(sql, [active, id])).rows[0] ?? null;
}
