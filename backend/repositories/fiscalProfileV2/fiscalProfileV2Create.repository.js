// ╔════════════════════════════════════════════════════════════════════╗
// ║ fiscalProfileV2Create.repository.js — create                       ║
// ║ Tabela: public."fiscalProfileV2"                                   ║
// ╚════════════════════════════════════════════════════════════════════╝

import db from '../../config/db.js';
import {
  FISCAL_PROFILE_V2_TABLE as TABLE,
  prepareFiscalProfileInsert,
} from './fiscalProfileV2.catalog.js';
import { RETURNING } from './fiscalProfileV2.sql.js';
import { writableEntries } from './fiscalProfileV2.sanitizers.js';

export async function create(payload = {}) {
  const entries = writableEntries(prepareFiscalProfileInsert(payload));
  const names = entries.map(([key]) => `"${key}"`);
  const values = entries.map(([, value]) => value);
  const placeholders = entries.map((_, index) => `$${index + 1}`);

  const sql = `
    INSERT INTO ${TABLE} (${names.join(', ')})
    VALUES (${placeholders.join(', ')})
    RETURNING ${RETURNING}
  `;

  return (await db.query(sql, values)).rows[0];
}
