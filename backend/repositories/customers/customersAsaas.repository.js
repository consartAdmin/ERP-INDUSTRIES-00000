// ╔════════════════════════════════════════════════════════════════════╗
// ║ customersAsaas.repository.js — sincronização de asaas_id           ║
// ║ Tabela: public."customers"                                         ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { tb } from './customers.table.js';
import { TB } from './customers.constants.js';
import { toNumOrNull, trimOrNull } from './customers.utils.js';

// ---------------------------------------------------------------------
// ASAAS — clientes ainda não sincronizados
// ---------------------------------------------------------------------
export async function listWithoutAsaasId({ limit = 100 } = {}) {
  const safeLimit = Math.min(
    Math.max(Number(limit) || 100, 1),
    100
  );

  const { rows } = await pool.query(
    `
      SELECT
        customer_id,
        trade_name,
        legal_name,
        tax_id,
        email,
        phone_number,
        mobile_number,
        asaas_id
      FROM ${tb()}
      WHERE NULLIF(BTRIM(COALESCE(asaas_id, '')), '') IS NULL
      ORDER BY customer_id ASC
      LIMIT $1
    `,
    [safeLimit]
  );

  return rows;
}

export async function saveAsaasId(customerId, asaasId) {
  const cid = toNumOrNull(customerId);
  const aid = trimOrNull(asaasId);

  if (!cid) {
    throw new Error('invalid customer_id');
  }

  if (!aid) {
    throw new Error('invalid asaas_id');
  }

  const { rows } = await pool.query(
    `
      UPDATE ${tb()}
      SET
        asaas_id = $1,
        updated_at = NOW()
      WHERE customer_id = $2
      RETURNING customer_id, asaas_id
    `,
    [aid, cid]
  );

  return rows[0] ?? null;
}

export async function countWithoutAsaasId() {
  const { rows } = await pool.query(`
    SELECT COUNT(*)::INT AS total
    FROM ${tb()}
    WHERE NULLIF(BTRIM(COALESCE(asaas_id, '')), '') IS NULL
  `);

  return rows[0]?.total ?? 0;
}

export default {
  listWithoutAsaasId,
  saveAsaasId,
  countWithoutAsaasId,
};
