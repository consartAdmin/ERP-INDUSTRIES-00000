// ╔════════════════════════════════════════════════════════════════════╗
// ║ ordersBillingQuery.repository.js — listByOrder / listByProviderId  ║
// ║ Tabela: public."ordersBilling"                                     ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './ordersBilling.constants.js';

// ---------------------------------------------------------------------
// listByOrder — histórico de billing do pedido
// ---------------------------------------------------------------------
export async function listByOrder(orderId) {
  const { rows } = await pool.query(
    `
    SELECT *
    FROM ${TB}
    WHERE order_id = $1
    ORDER BY created_at ASC, orders_billing_id ASC;
    `,
    [orderId],
  );
  return rows;
}

// ---------------------------------------------------------------------
// listByProviderId — para consultas por id do Asaas (webhook/sync)
// ---------------------------------------------------------------------
export async function listByProviderId(providerPaymentId) {
  if (!providerPaymentId) return [];

  const { rows } = await pool.query(
    `
    SELECT *
    FROM ${TB}
    WHERE provider_payment_id = $1
    ORDER BY created_at ASC, orders_billing_id ASC;
    `,
    [providerPaymentId],
  );

  return rows;
}
