// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsGroupsCreate.repository.js — create / upsert by name       ║
// ║ Tabela: public."productsGroups"                                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, COLS } from './productsGroups.constants.js';
import { notEmptyStr } from './productsGroups.sanitizers.js';
import { uniqueViolation } from './productsGroups.utils.js';
import { mapRow } from './productsGroups.mappers.js';

// ──────────────────────────────────────────────────────────────────────────────
// Create
// ──────────────────────────────────────────────────────────────────────────────
export async function createProductsGroup(payload = {}) {
  const errors = [];
  if (!notEmptyStr(payload.name)) {
    errors.push('O campo "name" é obrigatório.');
  } else if (payload.name.trim().length > 100) {
    errors.push('O campo "name" deve ter no máximo 100 caracteres.');
  }

  if (errors.length) {
    const e = new Error('ValidationError');
    e.details = errors;
    e.status = 400;
    throw e;
  }

  try {
    const res = await pool.query(
      `
        INSERT INTO public.${TB} (${COLS.name}, ${COLS.is_active})
        VALUES ($1, COALESCE($2, TRUE))
        RETURNING
          ${COLS.id},
          ${COLS.name},
          ${COLS.created_at},
          ${COLS.updated_at},
          ${COLS.is_active};
      `,
      [payload.name.trim(), payload.is_active ?? true],
    );
    return mapRow(res.rows[0]);
  } catch (err) {
    if (uniqueViolation(err)) {
      const e = new Error(`Já existe um grupo com o nome "${payload.name.trim()}".`);
      e.status = 409;
      throw e;
    }
    throw err;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Upsert by name
// ──────────────────────────────────────────────────────────────────────────────
export async function upsertProductsGroupByName({ name, is_active = true }) {
  if (!notEmptyStr(name)) {
    const e = new Error('O campo "name" é obrigatório.');
    e.status = 400;
    throw e;
  }

  const res = await pool.query(
    `
      INSERT INTO public.${TB} (${COLS.name}, ${COLS.is_active})
      VALUES ($1, $2)
      ON CONFLICT (${COLS.name})
      DO UPDATE SET
        ${COLS.is_active} = EXCLUDED.${COLS.is_active},
        ${COLS.updated_at} = NOW()
      RETURNING
        ${COLS.id},
        ${COLS.name},
        ${COLS.created_at},
        ${COLS.updated_at},
        ${COLS.is_active};
    `,
    [name.trim(), !!is_active],
  );

  return mapRow(res.rows[0]);
}
