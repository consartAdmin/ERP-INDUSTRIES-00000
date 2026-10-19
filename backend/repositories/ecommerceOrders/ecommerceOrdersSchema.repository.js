// ╔════════════════════════════════════════════════════════════════════╗
// ║ ecommerceOrdersSchema.repository.js — ensureTable (DDL)            ║
// ║ Tabela: "ecommerceOrders"                                          ║
// ╚════════════════════════════════════════════════════════════════════╝

import { q } from './ecommerceOrders.utils.js';

/* =========================================================================
   DDL opcional — garante tabela em ambientes novos
============================================================================*/

export async function ensureTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS "ecommerceOrders" (
      id                    BIGSERIAL PRIMARY KEY,
      subtotal              NUMERIC(12,2),
      created_at            TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
      asaas_payment_id      VARCHAR(80),
      asaas_invoice_url     TEXT,
      asaas_pix_qr_code     TEXT,
      asaas_pix_qr_code_url TEXT,
      asaas_billing_type    VARCHAR(20),
      asaas_status          VARCHAR(40),         -- 🔹 status/autorização Asaas
      shipping_value        NUMERIC(10,2) NOT NULL DEFAULT 0,
      shipping_free         BOOLEAN       NOT NULL DEFAULT FALSE,
      shipping_rule         TEXT,
      shipping_service      TEXT,
      shipping_provider     TEXT
    );
  `;
  await q(sql);

  await q(`
    CREATE INDEX IF NOT EXISTS idx_ecom_orders_created_at
      ON "ecommerceOrders"(created_at);
  `);
  await q(`
    CREATE INDEX IF NOT EXISTS idx_ecom_orders_asaas_payment_id
      ON "ecommerceOrders"(asaas_payment_id);
  `);
  await q(`
    CREATE INDEX IF NOT EXISTS idx_ecom_orders_asaas_status
      ON "ecommerceOrders"(asaas_status);
  `);
}
