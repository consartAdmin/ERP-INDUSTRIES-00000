// ╔════════════════════════════════════════════════════════════════════╗
// ║ unitsUpdate.repository.js — update / deactivate                    ║
// ║ Tabela: public.units                                               ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './units.constants.js';
import { notEmpty, toNum } from './units.sanitizers.js';

export async function update(id, patch = {}) {
  const sets = [];
  const values = [];
  let i = 1;

  if (patch.unit !== undefined) {
    if (!notEmpty(patch.unit)) throw new Error('Campo "unit" inválido.');
    sets.push(`unit = $${i++}`);
    values.push(String(patch.unit).trim().toUpperCase());
  }

  if (patch.description !== undefined) {
    sets.push(`description = $${i++}`);
    values.push(patch.description ?? null);
  }

  if (patch.fator !== undefined) {
    const f = toNum(patch.fator, null);
    if (f !== null && (!Number.isFinite(f) || f <= 0)) throw new Error('Campo "fator" deve ser numérico > 0.');
    sets.push(`fator = $${i++}`);
    values.push(f ?? 1);
  }

  if (patch.is_active !== undefined) {
    sets.push(`is_active = $${i++}`);
    values.push(!!patch.is_active);
  }

  if (!sets.length) throw new Error('Nada para atualizar.');

  const sql = `
    UPDATE ${TB}
       SET ${sets.join(', ')}, updated_at = NOW()
     WHERE unit_id = $${i}
     RETURNING *;
  `;
  values.push(Number(id));

  const { rows } = await pool.query(sql, values);
  return rows[0] || null;
}

export async function deactivate(id) {
  const { rows } = await pool.query(
    `UPDATE ${TB}
        SET is_active = FALSE, updated_at = NOW()
      WHERE unit_id = $1
      RETURNING *;`,
    [Number(id)]
  );
  return rows[0] || null;
}
