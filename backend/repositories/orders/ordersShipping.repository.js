// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ordersShipping.repository.js — Frete do pedido                       ║
// ║ Sincroniza budgetsShipping -> ordersShipping                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { ORDERS_PRIMARY_KEY, ORDER_UPDATE_COLUMNS } from './orders.catalog.js';
import { TB_ORDERS, TB_BUDGETS, TB_ORDER_SHIPPING, TB_BUDGET_SHIPPING } from './orders.constants.js';
import { buildUpdateSql } from './orders.sql.js';
import { normUf, normalizeMoney } from './orders.utils.js';

export async function syncShippingFromBudgetToOrder({
  client,
  budgetId,
  orderId,
}) {
  const { rows } = await client.query(
    `
    SELECT bs.*
    FROM ${TB_BUDGETS} b

    INNER JOIN ${TB_BUDGET_SHIPPING} bs
      ON bs.budget_shipping_id = b.budget_shipping_id

    WHERE b.budget_id = $1
    LIMIT 1
    `,
    [budgetId],
  );

  const shipping = rows[0];

  if (!shipping) {
    console.warn('[Shipping] Nenhum frete encontrado para o orçamento:', budgetId);
    return null;
  }

  const carrierAddress = [
    shipping.carrier_address,
    shipping.carrier_number,
    shipping.carrier_complement,
    shipping.carrier_district,
    shipping.carrier_zipcode,
  ]
    .filter(Boolean)
    .join(', ');

  const values = [
    Number(shipping.freight_mode ?? 9),
    normalizeMoney(shipping.freight_value, 0),
    shipping.carrier_name ?? null,
    shipping.carrier_cnpj_cpf ?? null,
    shipping.carrier_ie ?? null,
    carrierAddress || null,
    shipping.carrier_city ?? null,
    normUf(shipping.carrier_state ?? shipping.carrier_uf),
    shipping.vehicle_rntc ?? shipping.antt_code ?? null,
    shipping.vehicle_plate ?? null,
    normUf(shipping.vehicle_state ?? shipping.vehicle_uf),
    Number(shipping.volumes ?? shipping.volume_quantity ?? 0),
    shipping.volume_species ?? null,
    shipping.volume_brand ?? null,
    shipping.volume_numbering ?? null,
    Number(shipping.gross_weight ?? 0),
    Number(shipping.net_weight ?? 0),
  ];

  const currentRes = await client.query(
    `SELECT order_shipping_id FROM ${TB_ORDERS} WHERE order_id = $1 FOR UPDATE`,
    [orderId],
  );

  const currentShippingId = currentRes.rows?.[0]?.order_shipping_id ?? null;

  let shippingRes;

  if (currentShippingId) {
    shippingRes = await client.query(
      `
      UPDATE ${TB_ORDER_SHIPPING}
      SET
        freight_mode     = $1,
        freight_value    = $2,
        carrier_name     = $3,
        carrier_cnpj_cpf = $4,
        carrier_ie       = $5,
        carrier_address  = $6,
        carrier_city     = $7,
        carrier_uf       = $8,
        antt_code        = $9,
        vehicle_plate    = $10,
        vehicle_uf       = $11,
        volume_quantity  = $12,
        volume_species   = $13,
        volume_brand     = $14,
        volume_numbering = $15,
        gross_weight     = $16,
        net_weight       = $17,
        updated_at       = NOW()
      WHERE order_shipping_id = $18
      RETURNING *
      `,
      [...values, currentShippingId],
    );
  } else {
    shippingRes = await client.query(
      `
      INSERT INTO ${TB_ORDER_SHIPPING} (
        freight_mode,
        freight_value,
        carrier_name,
        carrier_cnpj_cpf,
        carrier_ie,
        carrier_address,
        carrier_city,
        carrier_uf,
        antt_code,
        vehicle_plate,
        vehicle_uf,
        volume_quantity,
        volume_species,
        volume_brand,
        volume_numbering,
        gross_weight,
        net_weight
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15, $16, $17
      )
      RETURNING *
      `,
      values,
    );

    const newShippingId = shippingRes.rows[0].order_shipping_id;

    const link = buildUpdateSql(
      TB_ORDERS,
      ORDERS_PRIMARY_KEY,
      ORDER_UPDATE_COLUMNS,
      { order_shipping_id: newShippingId },
      orderId,
    );
    await client.query(link.sql, link.values);
  }

  return shippingRes.rows?.[0] ?? null;
}
