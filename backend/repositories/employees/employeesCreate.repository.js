// ╔══════════════════════════════════════════════════════════════════════╗
// ║ employeesCreate.repository.js — create                               ║
// ║ Tabela: public.employees                                             ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './employees.constants.js';
import { ensureTable } from './employeesSchema.repository.js';
import { normalizePayload } from './employees.sanitizers.js';

export async function create(input = {}) {
  await ensureTable();
  const data = normalizePayload(input);

  if (!data.full_name) throw new Error('full_name is required');
  if (!data.cpf) throw new Error('cpf is required');
  if (!data.admission_date) throw new Error('admission_date is required');

  if (!('active' in data)) data.active = true;
  if (!('trial_extended' in data)) data.trial_extended = false;
  ['transport_benefit', 'food_benefit', 'meal_benefit', 'health_benefit'].forEach((k) => {
    if (!(k in data) || data[k] == null) data[k] = 0;
  });

  const cols = Object.keys(data);
  const vals = Object.values(data);
  const params = vals.map((_, i) => `$${i + 1}`);

  const { rows } = await pool.query(
    `INSERT INTO ${TB} (${cols.join(', ')}) VALUES (${params.join(', ')}) RETURNING *;`,
    vals
  );

  return rows[0];
}
