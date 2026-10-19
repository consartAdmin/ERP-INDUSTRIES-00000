// ╔════════════════════════════════════════════════════════════════════╗
// ║ consartCatalogs.schema.js — Status, Segmento e Vendedor da Consart ║
// ║ Cópias das tabelas da BH3, só para os clientes da Consart ERP:     ║
// ║   customerStatusTypes → customerStatusTypesConsart (tipos)         ║
// ║   customerStatus      → customerStatusConsart      (cliente→status)║
// ║   customerSegments    → customerSegmentsConsart                    ║
// ║   customerSubSegments → customerSubSegmentsConsart                 ║
// ║   sellers             → sellersConsart                             ║
// ║   SellerForCustomer   → SellerForCustomerConsart (cliente→vendedor)║
// ║ • Criadas com LIKE (colunas, defaults, índices); colunas novas da  ║
// ║   BH3 são copiadas a cada boot, assim como os triggers.            ║
// ║ • Ids em sequência própria de cada tabela Consart.                 ║
// ║ • Tipos de status nascem com uma cópia dos da BH3 (o CRM usa os    ║
// ║   códigos); segmentos e vendedores nascem vazios.                  ║
// ║ Roda ao subir o servidor, depois da customersConsart.              ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';

export async function ensureConsartCatalogTables(run = (sql) => pool.query(sql)) {
  await run(`
    DO $$
    DECLARE
      pair    TEXT[];
      base    REGCLASS;
      copy    REGCLASS;
      col     RECORD;
      trg     RECORD;
      def     TEXT;
    BEGIN
      FOREACH pair SLICE 1 IN ARRAY ARRAY[
        ['public."customerStatusTypes"', 'customerStatusTypesConsart'],
        ['public."customerStatus"',      'customerStatusConsart'],
        ['public."customerSegments"',    'customerSegmentsConsart'],
        ['public."customerSubSegments"', 'customerSubSegmentsConsart'],
        ['public."sellers"',             'sellersConsart'],
        ['public."SellerForCustomer"',   'SellerForCustomerConsart']
      ]
      LOOP
        base := to_regclass(pair[1]);
        CONTINUE WHEN base IS NULL;  -- tabela da BH3 ainda não existe

        IF to_regclass(format('public.%I', pair[2])) IS NULL THEN
          EXECUTE format(
            'CREATE TABLE public.%I (LIKE %s INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES)',
            pair[2], base
          );
        END IF;

        copy := to_regclass(format('public.%I', pair[2]));

        -- Colunas criadas depois na tabela da BH3
        FOR col IN
          SELECT a.attname, format_type(a.atttypid, a.atttypmod) AS coltype
            FROM pg_attribute a
           WHERE a.attrelid = base AND a.attnum > 0 AND NOT a.attisdropped
             AND NOT EXISTS (
               SELECT 1 FROM pg_attribute b
                WHERE b.attrelid = copy AND b.attname = a.attname AND NOT b.attisdropped
             )
        LOOP
          EXECUTE format('ALTER TABLE %s ADD COLUMN %I %s', copy, col.attname, col.coltype);
        END LOOP;

        -- Mesmos triggers (updated_at etc.)
        FOR trg IN
          SELECT t.oid, t.tgname
            FROM pg_trigger t
           WHERE t.tgrelid = base AND NOT t.tgisinternal AND t.tgconstraint = 0
        LOOP
          CONTINUE WHEN EXISTS (
            SELECT 1 FROM pg_trigger x
             WHERE x.tgrelid = copy AND x.tgname = trg.tgname || '_consart'
          );
          def := pg_get_triggerdef(trg.oid);
          -- troca só a tabela (primeiro " ON <tabela> " da definição)
          def := regexp_replace(def, ' ON \\S+ ', ' ON public.' || quote_ident(pair[2]) || ' ');
          def := regexp_replace(def, '^CREATE TRIGGER \\S+', 'CREATE TRIGGER ' || quote_ident(trg.tgname || '_consart'));
          EXECUTE def;
        END LOOP;
      END LOOP;

      -- Tipos de status: começa com os mesmos da BH3 (mesmos ids)
      IF to_regclass('public."customerStatusTypesConsart"') IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM public."customerStatusTypesConsart") THEN
        INSERT INTO public."customerStatusTypesConsart"
        SELECT * FROM public."customerStatusTypes";
      END IF;

      -- Ids em sequência própria: a BH3 reajusta a sequência dela no boot
      -- (setval pelo maior id da BH3), o que repetiria ids da Consart.
      FOREACH pair SLICE 1 IN ARRAY ARRAY[
        ['public."customerStatusTypes"', 'customerStatusTypesConsart'],
        ['public."customerStatus"',      'customerStatusConsart'],
        ['public."customerSegments"',    'customerSegmentsConsart'],
        ['public."customerSubSegments"', 'customerSubSegmentsConsart'],
        ['public."sellers"',             'sellersConsart'],
        ['public."SellerForCustomer"',   'SellerForCustomerConsart']
      ]
      LOOP
        base := to_regclass(pair[1]);
        copy := to_regclass(format('public.%I', pair[2]));
        CONTINUE WHEN base IS NULL OR copy IS NULL;

        FOR col IN
          SELECT a.attname
            FROM pg_attribute a
            LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
           WHERE a.attrelid = base AND a.attnum > 0 AND NOT a.attisdropped
             AND (a.attidentity <> '' OR pg_get_expr(d.adbin, d.adrelid) LIKE 'nextval(%')
        LOOP
          def := pair[2] || '_' || col.attname || '_seq';
          CONTINUE WHEN to_regclass(format('public.%I', def)) IS NOT NULL;
          CONTINUE WHEN EXISTS (
            SELECT 1 FROM pg_attribute b
             WHERE b.attrelid = copy AND b.attname = col.attname AND b.attidentity <> ''
          );
          EXECUTE format('CREATE SEQUENCE public.%I OWNED BY %s.%I', def, copy, col.attname);
          EXECUTE format('ALTER TABLE %s ALTER COLUMN %I SET DEFAULT nextval(%L::regclass)',
                         copy, col.attname, format('public.%I', def));
          EXECUTE format('SELECT setval(%L, COALESCE((SELECT max(%I) FROM %s), 0) + 1, false)',
                         format('public.%I', def), col.attname, copy);
        END LOOP;
      END LOOP;

      -- Vínculos apontam para as tabelas da Consart
      IF to_regclass('public."customerStatusConsart"') IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_customerStatusConsart_customer') THEN
          ALTER TABLE public."customerStatusConsart"
            ADD CONSTRAINT "fk_customerStatusConsart_customer"
            FOREIGN KEY (customer_id) REFERENCES public."customersConsart"(customer_id) ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_customerStatusConsart_type') THEN
          ALTER TABLE public."customerStatusConsart"
            ADD CONSTRAINT "fk_customerStatusConsart_type"
            FOREIGN KEY (status_type_id) REFERENCES public."customerStatusTypesConsart"(id);
        END IF;
      END IF;

      IF to_regclass('public."SellerForCustomerConsart"') IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_SellerForCustomerConsart_customer') THEN
          ALTER TABLE public."SellerForCustomerConsart"
            ADD CONSTRAINT "fk_SellerForCustomerConsart_customer"
            FOREIGN KEY (customer_id) REFERENCES public."customersConsart"(customer_id) ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_SellerForCustomerConsart_seller') THEN
          ALTER TABLE public."SellerForCustomerConsart"
            ADD CONSTRAINT "fk_SellerForCustomerConsart_seller"
            FOREIGN KEY (seller_id) REFERENCES public."sellersConsart"(id);
        END IF;
      END IF;
    END$$;
  `);
}

export default ensureConsartCatalogTables;
