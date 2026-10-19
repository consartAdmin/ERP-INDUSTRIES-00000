// ╔════════════════════════════════════════════════════════════════════╗
// ║ customersConsart.schema.js — DDL de public."customersConsart"      ║
// ║ Clientes da Consart ERP: mesma estrutura de public.customers.      ║
// ║ • Criada com LIKE public.customers (colunas, defaults, índices).   ║
// ║ • Sequência própria começando em 1.000.000, para o customer_id não ║
// ║   repetir ids da customers nas tabelas ligadas por customer_id     ║
// ║   (vendedor do cliente, IBGE, crédito, tabela de preço...).        ║
// ║ • A cada boot, colunas novas da customers são copiadas para cá.    ║
// ║ Roda sozinho ao subir o servidor (customers.index.js).             ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';

export async function ensureCustomersConsartTable(run = (sql) => pool.query(sql)) {
  await run(`
    DO $$
    DECLARE
      col RECORD;
    BEGIN
      IF to_regclass('public."customersConsart"') IS NULL THEN
        CREATE SEQUENCE IF NOT EXISTS public."customersConsart_customer_id_seq"
          START WITH 1000000;

        CREATE TABLE public."customersConsart"
          (LIKE public.customers INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);

        ALTER TABLE public."customersConsart"
          ALTER COLUMN customer_id
          SET DEFAULT nextval('public."customersConsart_customer_id_seq"');

        ALTER SEQUENCE public."customersConsart_customer_id_seq"
          OWNED BY public."customersConsart".customer_id;
      END IF;

      -- Colunas criadas depois na customers
      FOR col IN
        SELECT a.attname,
               format_type(a.atttypid, a.atttypmod) AS coltype
          FROM pg_attribute a
         WHERE a.attrelid = 'public.customers'::regclass
           AND a.attnum > 0
           AND NOT a.attisdropped
           AND NOT EXISTS (
             SELECT 1 FROM pg_attribute b
              WHERE b.attrelid = 'public."customersConsart"'::regclass
                AND b.attname = a.attname
                AND NOT b.attisdropped
           )
      LOOP
        EXECUTE format(
          'ALTER TABLE public."customersConsart" ADD COLUMN %I %s',
          col.attname, col.coltype
        );
      END LOOP;

      -- Mesmos triggers de timestamp da customers (se as funções existirem)
      IF to_regprocedure('public.customers_set_timestamps()') IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM pg_trigger
            WHERE tgname = 'trg_customersConsart_biu_timestamps'
              AND tgrelid = 'public."customersConsart"'::regclass
         ) THEN
        CREATE TRIGGER "trg_customersConsart_biu_timestamps"
          BEFORE INSERT OR UPDATE ON public."customersConsart"
          FOR EACH ROW EXECUTE FUNCTION public.customers_set_timestamps();
      END IF;

      IF to_regprocedure('public.set_updated_at_timestamp()') IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM pg_trigger
            WHERE tgname = 'trg_customersConsart_set_updated_at'
              AND tgrelid = 'public."customersConsart"'::regclass
         ) THEN
        CREATE TRIGGER "trg_customersConsart_set_updated_at"
          BEFORE UPDATE ON public."customersConsart"
          FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();
      END IF;
    END$$;
  `);
}

export default ensureCustomersConsartTable;
