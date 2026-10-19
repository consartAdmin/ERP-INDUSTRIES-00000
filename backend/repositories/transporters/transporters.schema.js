// ╔════════════════════════════════════════════════════════════════════╗
// ║ transporters.schema.js — DDL de public.transporters                ║
// ║ Espelha o schema real (\d transporters). Idempotente.              ║
// ║ Referenciada por: "budgetsShipping", "transportersAttachments"     ║
// ╚════════════════════════════════════════════════════════════════════╝

/**
 * Cria/atualiza public.transporters.
 * Recebe um `client` já dentro de uma transação (ver transportersSchema.repository.js).
 */
export async function ensureTransportersTable(client) {
  // ---------------------------------------------------------------
  // 1) Tabela (mesma ordem de colunas do banco real)
  //    Obs.: no banco real a sequência se chama transporters_id_seq
  //    (coluna renomeada de id → transporter_id); em banco novo o
  //    SERIAL cria transporters_transporter_id_seq — ambos funcionam.
  // ---------------------------------------------------------------
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.transporters (
      transporter_id           SERIAL PRIMARY KEY,
      trade_name               VARCHAR(200),
      legal_name               VARCHAR(200) NOT NULL,
      tax_id                   VARCHAR(20),
      cpf                      VARCHAR(14),
      postal_code              VARCHAR(15),
      street_type              VARCHAR(50),
      street_name              VARCHAR(255),
      street_number            VARCHAR(20),
      address_complement       VARCHAR(255),
      neighborhood             VARCHAR(100),
      city                     VARCHAR(100),
      state                    VARCHAR(2),
      ibge_location_id         VARCHAR(50),
      contact_name             VARCHAR(150),
      phone_number             VARCHAR(50),
      mobile_number            VARCHAR(50),
      state_registration       VARCHAR(100),
      municipal_registration   VARCHAR(100),
      rntrc                    VARCHAR(20),
      notes                    TEXT,
      is_active                BOOLEAN DEFAULT TRUE,
      created_at               TIMESTAMP DEFAULT now(),
      updated_at               TIMESTAMP DEFAULT now()
    );
  `);

  // ---------------------------------------------------------------
  // 2) Colunas que podem faltar em bancos antigos
  // ---------------------------------------------------------------
  await client.query(`
    ALTER TABLE public.transporters
      ADD COLUMN IF NOT EXISTS cpf                    VARCHAR(14),
      ADD COLUMN IF NOT EXISTS street_type            VARCHAR(50),
      ADD COLUMN IF NOT EXISTS ibge_location_id       VARCHAR(50),
      ADD COLUMN IF NOT EXISTS municipal_registration VARCHAR(100),
      ADD COLUMN IF NOT EXISTS rntrc                  VARCHAR(20),
      ADD COLUMN IF NOT EXISTS notes                  TEXT,
      ADD COLUMN IF NOT EXISTS is_active              BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS created_at             TIMESTAMP DEFAULT now(),
      ADD COLUMN IF NOT EXISTS updated_at             TIMESTAMP DEFAULT now();
  `);

  // ---------------------------------------------------------------
  // 3) Índices (mesmos nomes/definições do banco real)
  // ---------------------------------------------------------------
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_transporters_cpf
      ON public.transporters (cpf);

    CREATE INDEX IF NOT EXISTS idx_transporters_is_active
      ON public.transporters (is_active);

    CREATE INDEX IF NOT EXISTS idx_transporters_legal_name
      ON public.transporters (legal_name);

    CREATE INDEX IF NOT EXISTS idx_transporters_tax_id
      ON public.transporters (tax_id);

    CREATE INDEX IF NOT EXISTS idx_transporters_trade_name
      ON public.transporters (trade_name);
  `);

  // ---------------------------------------------------------------
  // 4) Sequência PK alinhada ao MAX(transporter_id)
  // ---------------------------------------------------------------
  const { rows } = await client.query(
    `SELECT pg_get_serial_sequence('public.transporters', 'transporter_id') AS seq_name`
  );

  const seqName = rows[0]?.seq_name;

  if (seqName) {
    await client.query(
      `SELECT setval(
         $1,
         COALESCE((SELECT MAX(transporter_id) FROM public.transporters), 0) + 1,
         false
       )`,
      [seqName]
    );
  }
}

export default ensureTransportersTable;
