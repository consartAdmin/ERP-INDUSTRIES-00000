// ╔══════════════════════════════════════════════════════════════════════╗
// ║ orders.schema.js — DDL de pedidos                                    ║
// ║ ordersPayments / ordersPaymentInstallments                           ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { ORDERS_PRIMARY_KEY } from './orders.catalog.js';
import { TB_ORDERS, TB_ORDERS_PAYMENTS, TB_ORDERS_PAYMENT_INSTALLMENTS } from './orders.constants.js';
import { qi } from './orders.sql.js';

// ----------------------------------------------------------------------
// DDL / Infra
// ----------------------------------------------------------------------
export const DDL = {
  // Core commercial tables (orders / ordersItems / ordersShipping)
  // are managed by SQL migrations. This API must not recreate legacy schemas.

  orders_payments: `
    CREATE TABLE IF NOT EXISTS ${TB_ORDERS_PAYMENTS} (
      order_payment_id BIGSERIAL PRIMARY KEY,

      order_id BIGINT NOT NULL
        REFERENCES ${TB_ORDERS}(${qi(ORDERS_PRIMARY_KEY)})
        ON DELETE CASCADE,

      payment_method_id BIGINT,
      payment_method_name VARCHAR(120),

      amount NUMERIC(14,2) NOT NULL,

      installments INTEGER,
      gap_one INTEGER,
      gap_two INTEGER,
      gap_three INTEGER,
      gap_four INTEGER,

      manual_due_date DATE,

      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE ${TB_ORDERS_PAYMENTS}
      ADD COLUMN IF NOT EXISTS manual_due_date DATE;

    CREATE INDEX IF NOT EXISTS idx_orders_payments_order_id
      ON ${TB_ORDERS_PAYMENTS}(order_id);
  `,

  orders_payment_installments: `
    CREATE TABLE IF NOT EXISTS ${TB_ORDERS_PAYMENT_INSTALLMENTS} (
      order_payment_installment_id BIGSERIAL PRIMARY KEY,

      order_payment_id BIGINT NOT NULL
        REFERENCES ${TB_ORDERS_PAYMENTS}(order_payment_id)
        ON DELETE CASCADE,

      installment_number INTEGER,
      due_date DATE,
      amount NUMERIC(14,2)
    );
  `,
};
