// ╔════════════════════════════════════════════════════════════════════╗
// ║ customers.schema.js — DDL de public.customers                      ║
// ║ Espelha o schema real (\d customers). Idempotente.                 ║
// ║ Depende de: customersAddressDelivery (FK), customerSegments (FK)   ║
// ╚════════════════════════════════════════════════════════════════════╝

/**
 * Cria/atualiza public.customers.
 * Recebe um `client` já dentro de uma transação (ver schema/index.js).
 */
export async function ensureCustomersTable(client) {
  // ---------------------------------------------------------------
  // 1) Tabela (mesma ordem de colunas do banco real)
  // ---------------------------------------------------------------
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.customers (
      customer_id               SERIAL PRIMARY KEY,
      trade_name                VARCHAR(255),
      tax_id                    VARCHAR(32),
      legal_name                VARCHAR(255),
      business_segment          VARCHAR(100),
      classification            VARCHAR(100),
      salesperson               VARCHAR(100),
      is_active                 BOOLEAN DEFAULT TRUE,
      email                     VARCHAR(255),
      postal_code               VARCHAR(15),
      street_type               VARCHAR(50),
      street_name               VARCHAR(255),
      street_number             VARCHAR(20),
      address_complement        VARCHAR(255),
      neighborhood              VARCHAR(100),
      city                      VARCHAR(100),
      state                     VARCHAR(50),
      contact_name              VARCHAR(150),
      phone_number              VARCHAR(50),
      mobile_number             VARCHAR(50),
      asaas_id                  VARCHAR(100),
      state_registration        VARCHAR(100),
      municipal_registration    VARCHAR(100),
      created_at                TIMESTAMP DEFAULT now(),
      updated_at                TIMESTAMP DEFAULT now(),
      segment_id                BIGINT,
      asaas_customer_id         TEXT,
      financial_contact_name    VARCHAR(150),
      financial_contact_email   VARCHAR(255),
      financial_contact_phone   VARCHAR(50),
      financial_contact_mobile  VARCHAR(50),
      billing_email             VARCHAR(255),
      invoice_email             VARCHAR(255),
      financial_contact_notes   TEXT,
      customer_ad_id            BIGINT,
      customer_type             VARCHAR(1) NOT NULL DEFAULT 'J'
    );
  `);

  // ---------------------------------------------------------------
  // 2) Colunas adicionadas depois (bancos antigos)
  // ---------------------------------------------------------------
  await client.query(`
    ALTER TABLE public.customers
      ADD COLUMN IF NOT EXISTS segment_id               BIGINT,
      ADD COLUMN IF NOT EXISTS asaas_customer_id        TEXT,
      ADD COLUMN IF NOT EXISTS financial_contact_name   VARCHAR(150),
      ADD COLUMN IF NOT EXISTS financial_contact_email  VARCHAR(255),
      ADD COLUMN IF NOT EXISTS financial_contact_phone  VARCHAR(50),
      ADD COLUMN IF NOT EXISTS financial_contact_mobile VARCHAR(50),
      ADD COLUMN IF NOT EXISTS billing_email            VARCHAR(255),
      ADD COLUMN IF NOT EXISTS invoice_email            VARCHAR(255),
      ADD COLUMN IF NOT EXISTS financial_contact_notes  TEXT,
      ADD COLUMN IF NOT EXISTS default_chart_account_id    BIGINT,
      ADD COLUMN IF NOT EXISTS default_cash_category_id    BIGINT,
      ADD COLUMN IF NOT EXISTS default_cash_subcategory_id BIGINT,
      ADD COLUMN IF NOT EXISTS customer_ad_id           BIGINT,
      ADD COLUMN IF NOT EXISTS customer_type            VARCHAR(1),
      ADD COLUMN IF NOT EXISTS created_at               TIMESTAMP DEFAULT now(),
      ADD COLUMN IF NOT EXISTS updated_at               TIMESTAMP DEFAULT now();
  `);

  // ---------------------------------------------------------------
  // 3) customer_type: normaliza só o que precisa + NOT NULL + CHECK
  //    (não reescreve a tabela inteira a cada boot)
  // ---------------------------------------------------------------
  await client.query(`
    UPDATE public.customers
       SET customer_type = CASE
             WHEN UPPER(BTRIM(customer_type)) = 'F' THEN 'F'
             ELSE 'J'
           END
     WHERE customer_type IS NULL
        OR customer_type NOT IN ('F', 'J');

    ALTER TABLE public.customers
      ALTER COLUMN customer_type SET DEFAULT 'J',
      ALTER COLUMN customer_type SET NOT NULL;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'customers_customer_type_check'
           AND conrelid = 'public.customers'::regclass
      ) THEN
        ALTER TABLE public.customers
          ADD CONSTRAINT customers_customer_type_check
          CHECK (customer_type IN ('F', 'J'));
      END IF;
    END$$;
  `);

  // ---------------------------------------------------------------
  // 4) state VARCHAR(50) — só altera se estiver diferente
  // ---------------------------------------------------------------
  await client.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
          FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'customers'
           AND column_name = 'state'
           AND COALESCE(character_maximum_length, 0) < 50
      ) THEN
        ALTER TABLE public.customers
          ALTER COLUMN state TYPE VARCHAR(50);
      END IF;
    END$$;
  `);

  // ---------------------------------------------------------------
  // 5) Foreign keys
  // ---------------------------------------------------------------
  await client.query(`
    DO $$
    BEGIN
      IF to_regclass('public."customersAddressDelivery"') IS NOT NULL
         AND NOT EXISTS (
           SELECT 1
             FROM pg_constraint
            WHERE conname = 'fk_customers_delivery_address'
              AND conrelid = 'public.customers'::regclass
         ) THEN
        ALTER TABLE public.customers
          ADD CONSTRAINT fk_customers_delivery_address
          FOREIGN KEY (customer_ad_id)
          REFERENCES public."customersAddressDelivery" (customer_ad_id)
          ON UPDATE CASCADE
          ON DELETE SET NULL;
      END IF;

      IF to_regclass('public."customerSegments"') IS NOT NULL
         AND NOT EXISTS (
           SELECT 1
             FROM pg_constraint
            WHERE conname = 'fk_customers_segment_id'
              AND conrelid = 'public.customers'::regclass
         ) THEN
        ALTER TABLE public.customers
          ADD CONSTRAINT fk_customers_segment_id
          FOREIGN KEY (segment_id)
          REFERENCES public."customerSegments" (segment_id)
          ON UPDATE CASCADE
          ON DELETE SET NULL;
      END IF;
    END$$;
  `);

  // ---------------------------------------------------------------
  // 6) Índices (mesmos nomes/definições do banco real)
  //    Obs.: String.raw preserva o \D+ da regex.
  // ---------------------------------------------------------------
  await client.query(String.raw`
    CREATE INDEX IF NOT EXISTS idx_customers_asaas_customer_id
      ON public.customers (asaas_customer_id);

    CREATE INDEX IF NOT EXISTS idx_customers_city
      ON public.customers (city);

    CREATE INDEX IF NOT EXISTS idx_customers_city_state
      ON public.customers (lower(city::text), state);

    CREATE INDEX IF NOT EXISTS idx_customers_customer_ad_id
      ON public.customers (customer_ad_id);

    CREATE INDEX IF NOT EXISTS idx_customers_email_idx
      ON public.customers (lower(TRIM(BOTH FROM email)))
      WHERE email IS NOT NULL
        AND TRIM(BOTH FROM email) <> '';

    CREATE INDEX IF NOT EXISTS idx_customers_email_lower
      ON public.customers (lower(email::text));

    CREATE INDEX IF NOT EXISTS idx_customers_email_lower_partial
      ON public.customers (lower(email::text))
      WHERE email IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_customers_legal_name
      ON public.customers (lower(legal_name::text));

    CREATE INDEX IF NOT EXISTS idx_customers_segment_id
      ON public.customers (segment_id);

    CREATE INDEX IF NOT EXISTS idx_customers_tax_id_digits
      ON public.customers (
        regexp_replace(COALESCE(tax_id, '')::text, '\D+'::text, ''::text, 'g'::text)
      );

    CREATE INDEX IF NOT EXISTS idx_customers_tax_id_like
      ON public.customers (tax_id);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_tax_id_unique
      ON public.customers (tax_id)
      WHERE tax_id IS NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_taxid_unique_digits
      ON public.customers (
        regexp_replace(COALESCE(tax_id, '')::text, '\D+'::text, ''::text, 'g'::text)
      )
      WHERE tax_id IS NOT NULL
        AND length(regexp_replace(tax_id::text, '\D+'::text, ''::text, 'g'::text)) > 0;

    CREATE INDEX IF NOT EXISTS idx_customers_trade_name
      ON public.customers (trade_name);
  `);

  // ---------------------------------------------------------------
  // 7) Triggers de timestamp
  //    Só cria se a função já existir no banco (corpo não versionado aqui).
  // ---------------------------------------------------------------
  await client.query(`
    DO $$
    BEGIN
      IF to_regprocedure('public.customers_set_timestamps()') IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM pg_trigger
            WHERE tgname = 'trg_customers_biu_timestamps'
              AND tgrelid = 'public.customers'::regclass
         ) THEN
        CREATE TRIGGER trg_customers_biu_timestamps
          BEFORE INSERT OR UPDATE ON public.customers
          FOR EACH ROW EXECUTE FUNCTION public.customers_set_timestamps();
      END IF;

      IF to_regprocedure('public.set_updated_at_timestamp()') IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM pg_trigger
            WHERE tgname = 'trg_customers_set_updated_at'
              AND tgrelid = 'public.customers'::regclass
         ) THEN
        CREATE TRIGGER trg_customers_set_updated_at
          BEFORE UPDATE ON public.customers
          FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();
      END IF;
    END$$;
  `);

  // ---------------------------------------------------------------
  // 8) Sequência PK alinhada ao MAX(customer_id)
  // ---------------------------------------------------------------
  const { rows } = await client.query(
    `SELECT pg_get_serial_sequence('public.customers', 'customer_id') AS seq_name`
  );

  const seqName = rows[0]?.seq_name;

  if (seqName) {
    await client.query(
      `SELECT setval(
         $1,
         COALESCE((SELECT MAX(customer_id) FROM public.customers), 0) + 1,
         false
       )`,
      [seqName]
    );
  }
}

export default ensureCustomersTable;
