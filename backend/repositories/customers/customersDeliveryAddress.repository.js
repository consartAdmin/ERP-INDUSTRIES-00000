// ╔════════════════════════════════════════════════════════════════════╗
// ║ customersDeliveryAddress.repository.js                             ║
// ║ Tabela: public."customersAddressDelivery"                          ║
// ║ Vínculo: customers.customer_ad_id                                  ║
// ╚════════════════════════════════════════════════════════════════════╝

import {
  TB,
  TB_DELIVERY,
  DELIVERY_COLUMN_MAP,
} from './customers.constants.js';
import { tb } from './customers.table.js';
import { toNumOrNull } from './customers.utils.js';
import {
  hasDeliveryAddressPayload,
  sanitizeDeliveryAddress,
} from './customers.sanitizers.js';

/**
 * Cria/atualiza o endereço de entrega do cliente.
 * Deve rodar dentro de uma transação (recebe o `client`).
 * Retorna o customer_ad_id, ou null se não houver payload/cliente.
 */
export async function saveDeliveryAddress(client, customerId, payload = {}) {
  if (!hasDeliveryAddressPayload(payload)) return null;

  const data = sanitizeDeliveryAddress(payload);

  const linkResult = await client.query(
    `SELECT customer_ad_id
       FROM ${tb()}
      WHERE customer_id = $1
      FOR UPDATE`,
    [customerId]
  );

  if (!linkResult.rows[0]) return null;

  let addressId = toNumOrNull(linkResult.rows[0].customer_ad_id);

  if (addressId) {
    const params = [];
    const sets = [];

    for (const [field, value] of Object.entries(data)) {
      params.push(value);
      sets.push(`"${DELIVERY_COLUMN_MAP[field]}" = $${params.length}`);
    }

    if (sets.length) {
      sets.push('"updated_at" = NOW()');
      params.push(addressId);

      const updated = await client.query(
        `UPDATE ${TB_DELIVERY}
            SET ${sets.join(', ')}
          WHERE customer_ad_id = $${params.length}
          RETURNING customer_ad_id`,
        params
      );

      if (!updated.rowCount) {
        addressId = null;
      }
    }
  }

  if (!addressId) {
    const columns = [];
    const values = [];
    const params = [];

    for (const [field, value] of Object.entries(data)) {
      columns.push(`"${DELIVERY_COLUMN_MAP[field]}"`);
      params.push(value);
      values.push(`$${params.length}`);
    }

    const insertSql = columns.length
      ? `INSERT INTO ${TB_DELIVERY}
           (${columns.join(', ')})
         VALUES
           (${values.join(', ')})
         RETURNING customer_ad_id`
      : `INSERT INTO ${TB_DELIVERY}
         DEFAULT VALUES
         RETURNING customer_ad_id`;

    const inserted = await client.query(insertSql, params);

    addressId = inserted.rows[0].customer_ad_id;

    await client.query(
      `UPDATE ${tb()}
          SET customer_ad_id = $1,
              updated_at = NOW()
        WHERE customer_id = $2`,
      [addressId, customerId]
    );
  }

  return addressId;
}

export default {
  saveDeliveryAddress,
};
