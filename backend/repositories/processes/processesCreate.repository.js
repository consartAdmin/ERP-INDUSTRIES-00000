// ╔════════════════════════════════════════════════════════════════════╗
// ║ processesCreate.repository.js — create (UPSERT em codigo)          ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, ALIAS, nowSql } from './processes.constants.js';
import { normalizePayload } from './processes.sanitizers.js';
import { ensureTable } from './processesSchema.repository.js';

/* ──────────────────────────────────────────────────────────────
   create() — Inserção com UPSERT em codigo
────────────────────────────────────────────────────────────── */
export async function create(input = {}) {
  await ensureTable();
  const data = normalizePayload(input);

  if (!data.codigo) throw new Error('codigo é obrigatório.');
  if (!data.nome) throw new Error('nome é obrigatório.');

  // Normaliza código (sem espaços extras)
  data.codigo = String(data.codigo).trim();

  const cols = Object.keys(data);
  const vals = Object.values(data);
  const params = vals.map((_, i) => `$${i + 1}`);

  const setUpdates = cols
    .filter((c) => c !== 'codigo') // codigo não muda no conflito
    .map((c) => `${c} = COALESCE(EXCLUDED.${c}, ${ALIAS}.${c})`);

  const sql = `
    INSERT INTO ${TB} AS ${ALIAS} (${cols.join(', ')})
    VALUES (${params.join(', ')})
    ON CONFLICT (codigo) DO UPDATE
    SET ${setUpdates.length ? setUpdates.join(', ') + ',' : ''} updated_at = ${nowSql}
    RETURNING *;
  `;

  const { rows } = await pool.query(sql, vals);
  return rows[0];
}
