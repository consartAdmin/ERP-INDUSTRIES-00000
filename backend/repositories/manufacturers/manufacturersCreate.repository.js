// ╔════════════════════════════════════════════════════════════════════╗
// ║ manufacturersCreate.repository.js — create                         ║
// ║ Tabela: public.manufacturers                                       ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE } from './manufacturers.constants.js';
import { ok, fail } from './manufacturers.utils.js';
import { normalize } from './manufacturers.mappers.js';

// ─────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────
export async function create(data = {}) {
  try {
    if (!data.trade_name?.trim()) {
      return fail('Campo trade_name é obrigatório');
    }

    const cols = [];
    const vals = [];
    const params = [];

    const add = (col, val) => {
      if (val === undefined) return;
      cols.push(col);
      params.push(val);
      vals.push(`$${params.length}`);
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
    add('country', data.country ?? 'BRAZIL');
    add('active', data.active ?? true);
    add('notes', data.notes);

    const sql = `
      INSERT INTO ${TABLE} (${cols.join(', ')})
      VALUES (${vals.join(', ')})
      RETURNING *
    `;

    const { rows } = await pool.query(sql, params);
    return ok(normalize(rows[0]));

  } catch (err) {
    console.error('[manufacturersApi:create] Erro:', err);
    return fail(err.message, 500);
  }
}
