// ╔════════════════════════════════════════════════════════════════════╗
// ║ customersAddressDelivery.schema.js                                 ║
// ║ DDL de public."customersAddressDelivery". Idempotente.             ║
// ║ ⚠ Baseado no ensureTable antigo — conferir com \d no banco real.   ║
// ╚════════════════════════════════════════════════════════════════════╝

/**
 * Cria/atualiza public."customersAddressDelivery".
 * Deve rodar ANTES de customers.schema.js (FK customer_ad_id).
 */
export async function ensureCustomersAddressDeliveryTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public."customersAddressDelivery" (
      customer_ad_id                   BIGSERIAL PRIMARY KEY,
      customer_ad_street_type          VARCHAR(50),
      customer_ad_street_name          VARCHAR(255),
      customer_ad_street_number        VARCHAR(20),
      customer_ad_address_complement   VARCHAR(255),
      customer_ad_neighborhood         VARCHAR(150),
      customer_ad_city                 VARCHAR(150),
      customer_ad_state                CHAR(2),
      active                           BOOLEAN NOT NULL DEFAULT TRUE,
      created_at                       TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at                       TIMESTAMP NOT NULL DEFAULT NOW()
    );

    ALTER TABLE public."customersAddressDelivery"
      ADD COLUMN IF NOT EXISTS customer_ad_street_type        VARCHAR(50),
      ADD COLUMN IF NOT EXISTS customer_ad_street_name        VARCHAR(255),
      ADD COLUMN IF NOT EXISTS customer_ad_street_number      VARCHAR(20),
      ADD COLUMN IF NOT EXISTS customer_ad_address_complement VARCHAR(255),
      ADD COLUMN IF NOT EXISTS customer_ad_neighborhood       VARCHAR(150),
      ADD COLUMN IF NOT EXISTS customer_ad_city               VARCHAR(150),
      ADD COLUMN IF NOT EXISTS customer_ad_state              CHAR(2),
      ADD COLUMN IF NOT EXISTS active     BOOLEAN   NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();
  `);
}

export default ensureCustomersAddressDeliveryTable;
