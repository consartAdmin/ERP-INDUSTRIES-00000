// ╔════════════════════════════════════════════════════════════════════╗
// ║ ecommerceOrderItemsSchema.repository.js — ensureTable (DDL)        ║
// ║ Tabela: "ecommerceOrderItems"                                      ║
// ╚════════════════════════════════════════════════════════════════════╝

import { q } from './ecommerceOrderItems.utils.js';

/* =========================================================================
   DDL opcional — garante tabela em ambientes novos (não obrigatório)
============================================================================*/

export async function ensureTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS "ecommerceOrderItems" (
      id           BIGSERIAL PRIMARY KEY,
      order_id     BIGINT REFERENCES "ecommerceOrders"(id) ON DELETE CASCADE,
      product_id   BIGINT,
      product_code VARCHAR(50),
      name         TEXT,
      unit         VARCHAR(20),
      qty          NUMERIC(12,2),
      price        NUMERIC(12,2),
      total        NUMERIC(12,2)
    );
  `;
  await q(sql);

  await q(`
    CREATE INDEX IF NOT EXISTS idx_ecom_order_items_order
      ON "ecommerceOrderItems"(order_id);
  `);
  await q(`
    CREATE INDEX IF NOT EXISTS idx_ecom_order_items_product
      ON "ecommerceOrderItems"(product_id);
  `);
  await q(`
    CREATE INDEX IF NOT EXISTS idx_ecom_order_items_code
      ON "ecommerceOrderItems"(product_code);
  `);
}
