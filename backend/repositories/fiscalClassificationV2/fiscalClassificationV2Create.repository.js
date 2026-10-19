// ╔════════════════════════════════════════════════════════════════════╗
// ║ fiscalClassificationV2Create.repository.js — create                ║
// ║ Tabela: public."fiscalClassificationV2"                            ║
// ╚════════════════════════════════════════════════════════════════════╝

import db from '../../config/db.js';
import {
  FISCAL_CLASSIFICATION_V2_TABLE as TABLE,
  prepareFiscalClassificationInsert,
} from './fiscalClassificationV2.catalog.js';
import { RETURNING } from './fiscalClassificationV2.sql.js';
import { writableEntries } from './fiscalClassificationV2.sanitizers.js';

export async function create(payload = {}) {
  const entries = writableEntries(prepareFiscalClassificationInsert(payload));
  const names = entries.map(([key]) => `"${key}"`);
  const values = entries.map(([, value]) => value);
  const params = entries.map((_, index) => `$${index + 1}`);
  const sql = `
    INSERT INTO ${TABLE} (${names.join(', ')})
    VALUES (${params.join(', ')})
    RETURNING ${RETURNING}
  `;
  return (await db.query(sql, values)).rows[0];
}
