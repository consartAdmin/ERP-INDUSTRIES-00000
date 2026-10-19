// ╔════════════════════════════════════════════════════════════════════╗
// ║ customersCreate.repository.js — INSERT + endereço + IBGE           ║
// ║ Tabela: public."customers"                                         ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { tb } from './customers.table.js';
import { TB, FIELDS } from './customers.constants.js';
import { sanitizeCreate } from './customers.sanitizers.js';
import { saveDeliveryAddress } from './customersDeliveryAddress.repository.js';
import { upsertCustomersIbge } from './customersIbge.repository.js';
import { getById } from './customersGetById.repository.js';

/**
 * CREATE
 */
export async function create(payload = {}) {
  const data = sanitizeCreate(payload);

  if (!data.trade_name) {
    throw new Error('trade_name is required');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const cols = [];
    const vals = [];
    const params = [];

    for (const k of FIELDS) {
      if (data[k] !== undefined) {
        cols.push(`"${k}"`);
        params.push(data[k]);
        vals.push(`$${params.length}`);
      }
    }

    const { rows } = await client.query(
      `INSERT INTO ${tb()}
        (${cols.join(', ')})
       VALUES
        (${vals.join(', ')})
       RETURNING *`,
      params
    );

    const created = rows[0];

    await saveDeliveryAddress(client, created.customer_id, payload);

    await upsertCustomersIbge({
      customer_id: created.customer_id,
      uf: created.state,
      city: created.city,
      codigo_ibge: payload?.ibge_city_code ?? payload?.codigo_ibge,
      source: payload?.ibge_source ?? 'manual',
      confidence: payload?.ibge_confidence ?? 100,
      db: client,
    });

    await client.query('COMMIT');

    return await getById(created.customer_id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export default create;
