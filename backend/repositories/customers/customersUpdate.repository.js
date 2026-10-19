// ╔════════════════════════════════════════════════════════════════════╗
// ║ customersUpdate.repository.js — UPDATE + endereço + IBGE           ║
// ║ Tabela: public."customers"                                         ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { tb } from './customers.table.js';
import { TB } from './customers.constants.js';
import { toNumOrNull } from './customers.utils.js';
import { sanitizeUpdate } from './customers.sanitizers.js';
import { saveDeliveryAddress } from './customersDeliveryAddress.repository.js';
import { upsertCustomersIbge } from './customersIbge.repository.js';
import { getById } from './customersGetById.repository.js';

/**
 * UPDATE BY ID
 */
export async function updateById(id, payload = {}) {
  const cid = toNumOrNull(id);

  if (!cid) {
    throw new Error('invalid customer_id');
  }

  const incomingCodigoIbge = payload?.ibge_city_code ?? payload?.codigo_ibge;
  const incomingSource = payload?.ibge_source;
  const incomingConfidence = payload?.ibge_confidence;

  const data = sanitizeUpdate(payload);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const currentResult = await client.query(
      `SELECT *
         FROM ${tb()}
        WHERE customer_id = $1
        FOR UPDATE`,
      [cid]
    );

    if (!currentResult.rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }

    let updatedBase = currentResult.rows[0];

    const sets = [];
    const params = [];

    for (const [k, v] of Object.entries(data)) {
      params.push(v);
      sets.push(`"${k}" = $${params.length}`);
    }

    if (sets.length) {
      sets.push('"updated_at" = NOW()');
      params.push(cid);

      const updatedResult = await client.query(
        `UPDATE ${tb()}
            SET ${sets.join(', ')}
          WHERE customer_id = $${params.length}
          RETURNING *`,
        params
      );

      updatedBase = updatedResult.rows[0];
    }

    await saveDeliveryAddress(client, cid, payload);

    const shouldUpsertIbge =
      payload?.state !== undefined ||
      payload?.city !== undefined ||
      incomingCodigoIbge !== undefined;

    if (shouldUpsertIbge) {
      await upsertCustomersIbge({
        customer_id: cid,
        uf: updatedBase.state,
        city: updatedBase.city,
        codigo_ibge: incomingCodigoIbge,
        source: incomingSource ?? 'manual',
        confidence: incomingConfidence ?? 100,
        db: client,
      });
    }

    await client.query('COMMIT');

    return await getById(cid);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export default updateById;
