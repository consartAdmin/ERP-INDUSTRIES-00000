// ╔════════════════════════════════════════════════════════════════════╗
// ║ priceCommissionsCreate.repository.js — create                      ║
// ║ Tabela: public."priceCommissions"                                  ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_PC } from './priceCommissions.constants.js';
import { normalizeIn } from './priceCommissions.sanitizers.js';

export async function create(body = {}) {
  const v = normalizeIn(body);

  const cols = [
    'price_id','seller_id',
    'commission_type','percent_value','fixed_value',
    'active','valid_from','valid_to',
  ];
  const args = cols.map((c) => v[c]);
  const vals = cols.map((_, i) => `$${i + 1}`);

  const sql = `
    INSERT INTO ${TB_PC} (${cols.join(', ')})
    VALUES (${vals.join(', ')})
    RETURNING commission_id
  `;

  const client = await pool.connect();
  try {
    const r = await client.query(sql, args);
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
