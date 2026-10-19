// ╔════════════════════════════════════════════════════════════════════╗
// ║ cashDocumentTypesCreate.repository.js — createCashDocumentType     ║
// ║ Tabela: public."cashDocumentTypes"                                 ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE } from './cashDocumentTypes.constants.js';
import { normalizeName, normalizeBoolean } from './cashDocumentTypes.sanitizers.js';

export async function createCashDocumentType(payload = {}) {
  const name = normalizeName(payload.name);
  const isActive = normalizeBoolean(payload.is_active, true);

  if (!name) {
    const error = new Error('Informe o nome do tipo de documento.');
    error.statusCode = 400;
    throw error;
  }

  const duplicate = await pool.query(
    `SELECT id FROM ${TABLE} WHERE LOWER(name) = LOWER($1) LIMIT 1`,
    [name]
  );

  if (duplicate.rowCount) {
    const error = new Error('Já existe um tipo de documento com esse nome.');
    error.statusCode = 409;
    throw error;
  }

  const { rows } = await pool.query(
    `
      INSERT INTO ${TABLE} (name, is_active)
      VALUES ($1, $2)
      RETURNING id, name, is_active, created_at, updated_at
    `,
    [name, isActive]
  );

  return rows[0];
}
