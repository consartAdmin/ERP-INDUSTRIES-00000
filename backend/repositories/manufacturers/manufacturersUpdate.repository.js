// ╔════════════════════════════════════════════════════════════════════╗
// ║ manufacturersUpdate.repository.js — update (parcial)               ║
// ║ Tabela: public.manufacturers                                       ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE, PK } from './manufacturers.constants.js';
import { ok, fail } from './manufacturers.utils.js';
import { normalize } from './manufacturers.mappers.js';

// ─────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────
export async function update(id, data = {}) {
  try {
    const sets = [];
    const params = [];

    const add = (col, val) => {
      if (val === undefined) return;
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    };

    add('trade_name', data.trade_name);
    add('corporate_name', data.corporate_name);
    add('tax_id', data.tax_id);
    add('state_registration', data.state_registration);
    add('municipal_registration', data.municipal_registration);
    add('email', data.email);
    add('phone', data.phone);
    add('mobile', data.mobile);
    add('website', data.website);
    add('street', data.street);
    add('number', data.number);
    add('complement', data.complement);
    add('neighborhood', data.neighborhood);
    add('city', data.city);
    add('state', data.state);
    add('zipcode', data.zipcode);
    add('country', data.country);
    add('active', data.active);
    add('notes', data.notes);

    // updated_at sempre atualizado
    add('updated_at', new Date());

    if (!sets.length) return fail('Nenhum campo para atualizar');

    params.push(id);
    const sql = `
      UPDATE ${TABLE}
      SET ${sets.join(', ')}
      WHERE ${PK} = $${params.length}
      RETURNING *
    `;

    const { rows } = await pool.query(sql, params);
    if (!rows.length) return fail('Fabricante não encontrado', 404);

    return ok(normalize(rows[0]));

  } catch (err) {
    console.error('[manufacturersApi:update] Erro:', err);
    return fail(err.message, 500);
  }
}
