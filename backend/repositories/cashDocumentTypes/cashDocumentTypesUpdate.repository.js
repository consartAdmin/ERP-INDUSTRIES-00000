// ╔════════════════════════════════════════════════════════════════════╗
// ║ cashDocumentTypesUpdate.repository.js — update / ativo / remove    ║
// ║ Tabela: public."cashDocumentTypes"                                 ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE } from './cashDocumentTypes.constants.js';
import { normalizeName, normalizeId, normalizeBoolean } from './cashDocumentTypes.sanitizers.js';
import { getCashDocumentTypeById } from './cashDocumentTypesQuery.repository.js';

export async function updateCashDocumentType(idValue, payload = {}) {
  const id = normalizeId(idValue);
  if (!id) {
    const error = new Error('ID inválido.');
    error.statusCode = 400;
    throw error;
  }

  const current = await getCashDocumentTypeById(id);
  if (!current) return null;

  const name = payload.name === undefined
    ? current.name
    : normalizeName(payload.name);

  const isActive = payload.is_active === undefined
    ? current.is_active
    : normalizeBoolean(payload.is_active, current.is_active);

  if (!name) {
    const error = new Error('Informe o nome do tipo de documento.');
    error.statusCode = 400;
    throw error;
  }

  const duplicate = await pool.query(
    `
      SELECT id
        FROM ${TABLE}
       WHERE LOWER(name) = LOWER($1)
         AND id <> $2
       LIMIT 1
    `,
    [name, id]
  );

  if (duplicate.rowCount) {
    const error = new Error('Já existe um tipo de documento com esse nome.');
    error.statusCode = 409;
    throw error;
  }

  const { rows } = await pool.query(
    `
      UPDATE ${TABLE}
         SET name = $1,
             is_active = $2,
             updated_at = NOW()
       WHERE id = $3
       RETURNING id, name, is_active, created_at, updated_at
    `,
    [name, isActive, id]
  );

  return rows[0] ?? null;
}

export async function setCashDocumentTypeActive(idValue, isActiveValue) {
  const id = normalizeId(idValue);
  if (!id) {
    const error = new Error('ID inválido.');
    error.statusCode = 400;
    throw error;
  }

  const isActive = normalizeBoolean(isActiveValue, false);

  const { rows } = await pool.query(
    `
      UPDATE ${TABLE}
         SET is_active = $1,
             updated_at = NOW()
       WHERE id = $2
       RETURNING id, name, is_active, created_at, updated_at
    `,
    [isActive, id]
  );

  return rows[0] ?? null;
}

export async function toggleCashDocumentTypeActive(idValue) {
  const id = normalizeId(idValue);
  if (!id) {
    const error = new Error('ID inválido.');
    error.statusCode = 400;
    throw error;
  }

  const { rows } = await pool.query(
    `
      UPDATE ${TABLE}
         SET is_active = NOT is_active,
             updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, is_active, created_at, updated_at
    `,
    [id]
  );

  return rows[0] ?? null;
}

// Exclusão lógica para preservar vínculos históricos de Contas a Pagar.
export async function removeCashDocumentType(idValue) {
  return setCashDocumentTypeActive(idValue, false);
}
