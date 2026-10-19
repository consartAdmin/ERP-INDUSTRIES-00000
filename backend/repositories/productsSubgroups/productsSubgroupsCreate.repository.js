// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsSubgroupsCreate.repository.js — criar / upsert por name    ║
// ║ Tabela: public."productsSubgroups"                                 ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, COLS } from './productsSubgroups.constants.js';
import { notEmptyStr } from './productsSubgroups.sanitizers.js';
import { uniqueViolation } from './productsSubgroups.utils.js';
import { mapRow } from './productsSubgroups.mappers.js';

// ──────────────────────────────────────────────────────────────────────────────
/** Criar */
// ──────────────────────────────────────────────────────────────────────────────
export async function createProductsSubgroup(payload) {
  const errors = [];
  if (!notEmptyStr(payload?.name)) errors.push('O campo "name" é obrigatório.');
  if (errors.length) {
    const e = new Error('ValidationError'); e.details = errors; e.status = 400; throw e;
  }

  try {
    const res = await pool.query(
      `INSERT INTO public.${TB} (${COLS.name}, ${COLS.group_id}, ${COLS.is_active})
       VALUES ($1, $2, COALESCE($3, TRUE))
       RETURNING ${COLS.id}, ${COLS.name}, ${COLS.group_id}, ${COLS.created_at}, ${COLS.updated_at}, ${COLS.is_active};`,
      [payload.name.trim(), payload.group_id ?? null, payload.is_active ?? true]
    );
    return mapRow(res.rows[0]);
  } catch (err) {
    if (uniqueViolation(err)) {
      const e = new Error(`Já existe um subgrupo com o nome "${payload.name.trim()}".`);
      e.status = 409; throw e;
    }
    throw err;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
/** Upsert por name */
// ──────────────────────────────────────────────────────────────────────────────
export async function upsertProductsSubgroupByName({ name, group_id = null, is_active = true }) {
  if (!notEmptyStr(name)) {
    const e = new Error('O campo "name" é obrigatório.'); e.status = 400; throw e;
  }
  const res = await pool.query(
    `INSERT INTO public.${TB} (${COLS.name}, ${COLS.group_id}, ${COLS.is_active})
     VALUES ($1, $2, $3)
     ON CONFLICT (${COLS.name})
     DO UPDATE SET
       ${COLS.group_id} = EXCLUDED.${COLS.group_id},
       ${COLS.is_active} = EXCLUDED.${COLS.is_active},
       ${COLS.updated_at} = NOW()
     RETURNING ${COLS.id}, ${COLS.name}, ${COLS.group_id}, ${COLS.created_at}, ${COLS.updated_at}, ${COLS.is_active};`,
    [name.trim(), group_id, !!is_active]
  );
  return mapRow(res.rows[0]);
}
