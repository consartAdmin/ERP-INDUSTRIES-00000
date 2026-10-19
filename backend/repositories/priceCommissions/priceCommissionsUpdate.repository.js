// ╔════════════════════════════════════════════════════════════════════╗
// ║ priceCommissionsUpdate.repository.js — update                      ║
// ║ Tabela: public."priceCommissions"                                  ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_PC } from './priceCommissions.constants.js';
import { normalizeIn } from './priceCommissions.sanitizers.js';

export async function update(id, body = {}) {
  const pid = Number(id);
  if (!Number.isFinite(pid) || pid <= 0) return { ok: false, error: 'ID inválido' };

  const v = normalizeIn(body);

  const setCols = [
    'price_id','seller_id',
    'commission_type','percent_value','fixed_value',
    'active','valid_from','valid_to',
  ];
  const sets = setCols.map((c, i) => `${c} = $${i + 1}`);
  const args = setCols.map((c) => v[c]);
  args.push(pid);

  const sql = `
    UPDATE ${TB_PC}
    SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE commission_id = $${args.length}
    RETURNING commission_id
  `;

  const client = await pool.connect();
  try {
    const r = await client.query(sql, args);
    if (!r.rowCount) return { ok: false, error: 'NOT_FOUND' };
    return { ok: true, id: r.rows?.[0]?.commission_id };
  } catch (err) {
    const msg = String(err?.message || err);
    if (msg.includes('uq_priceCommissions_unique')) {
      return { ok: false, error: 'Já existe regra para este vendedor/tabela nesta data inicial.' };
    }
    return { ok: false, error: msg };
  } finally {
    client.release();
  }
}
