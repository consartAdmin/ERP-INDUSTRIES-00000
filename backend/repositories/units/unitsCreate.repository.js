// ╔════════════════════════════════════════════════════════════════════╗
// ║ unitsCreate.repository.js — create / upsertByUnit                  ║
// ║ Tabela: public.units                                               ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './units.constants.js';
import { notEmpty, toNum } from './units.sanitizers.js';

export async function create({ unit, description = null, fator = 1, is_active = true } = {}) {
  if (!notEmpty(unit)) throw new Error('Campo "unit" é obrigatório.');
  const u = unit.trim().toUpperCase();
  const f = toNum(fator, 1);
  if (!Number.isFinite(f) || f <= 0) throw new Error('Campo "fator" deve ser numérico > 0.');

  const { rows } = await pool.query(
    `INSERT INTO ${TB} (unit, description, fator, is_active)
     VALUES ($1, $2, $3, $4)
     RETURNING *;`,
    [u, description, f, !!is_active]
  );
  return rows[0];
}

export async function upsertByUnit({ unit, description = null, fator = 1, is_active = true } = {}) {
  if (!notEmpty(unit)) throw new Error('Campo "unit" é obrigatório.');
  const u = unit.trim().toUpperCase();
  const f = toNum(fator, 1);
  if (!Number.isFinite(f) || f <= 0) throw new Error('Campo "fator" deve ser numérico > 0.');

  const { rows } = await pool.query(
    `
    INSERT INTO ${TB} (unit, description, fator, is_active)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (unit)
    DO UPDATE SET
      description = EXCLUDED.description,
      fator = EXCLUDED.fator,
      is_active = EXCLUDED.is_active,
      updated_at = NOW()
    RETURNING *;
    `,
    [u, description, f, !!is_active]
  );
  return rows[0];
}
