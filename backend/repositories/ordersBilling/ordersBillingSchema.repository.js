// ╔════════════════════════════════════════════════════════════════════╗
// ║ ordersBillingSchema.repository.js — ensureTable (idempotente)      ║
// ║ Tabela: public."ordersBilling"                                     ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './ordersBilling.constants.js';

// ---------------------------------------------------------------------
// CREATE TABLE (idempotente)
// ---------------------------------------------------------------------
export async function ensureTable() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS ${TB} (
        orders_billing_id   SERIAL PRIMARY KEY,
        order_id            INTEGER NOT NULL
                            REFERENCES public.orders (id) ON DELETE CASCADE,
        billing_source      VARCHAR(40) NOT NULL DEFAULT 'ASAAS',
        billing_type        VARCHAR(40) NOT NULL,
        provider_payment_id VARCHAR(100),
        external_reference  VARCHAR(255),
        amount              NUMERIC(15,2) NOT NULL DEFAULT 0,
        due_date            DATE,
        paid_date           DATE,
        status              VARCHAR(40) NOT NULL DEFAULT 'PENDING',
        status_details      TEXT,
        bank_slip_url       TEXT,
        bank_slip_pdf_url   TEXT,
        nosso_numero        VARCHAR(100),
        installment_number  INTEGER,
        installments_total  INTEGER,
        metadata            JSONB,
        created_at          TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
        updated_at          TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ordersbilling_order
        ON ${TB} (order_id);
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_ordersbilling_order_provider
        ON ${TB} (order_id, billing_source, provider_payment_id)
        WHERE provider_payment_id IS NOT NULL;
    `);

    // index auxiliar para webhooks / consultas por id do Asaas
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ordersbilling_provider
        ON ${TB} (provider_payment_id);
    `);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ordersBillingApi.ensureTable] EXC:', err);
    throw err;
  } finally {
    client.release();
  }
}
