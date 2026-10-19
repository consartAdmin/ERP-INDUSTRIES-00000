```SQL

BEGIN;

-- ------------------------------------------------------------
-- Sequence
-- ------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.products_product_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- ------------------------------------------------------------
-- Table
-- ------------------------------------------------------------
CREATE TABLE public.products (
    product_id          integer                     NOT NULL DEFAULT nextval('products_product_id_seq'::regclass),
    product_code        character varying(50)       NOT NULL,
    description         text                        NOT NULL,
    barcode             character varying(100),
    manufacturer_ref    character varying(100),
    cost_price          numeric(14,2)               DEFAULT 0,
    product_group_id    integer,
    product_subgroup_id integer,
    product_stock_id    integer,
    product_location_id integer,
    supplier_id         integer,
    manufacturer_id     integer,
    product_imagem_id   integer,
    created_at          timestamp without time zone DEFAULT now(),
    updated_at          timestamp without time zone DEFAULT now(),
    is_active           boolean                     DEFAULT true,

    CONSTRAINT products_pkey PRIMARY KEY (product_id),
    CONSTRAINT products_product_code_key UNIQUE (product_code),
    CONSTRAINT products_product_stock_id_fkey FOREIGN KEY (product_stock_id)
        REFERENCES public."productsStock" (product_stock_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

ALTER SEQUENCE public.products_product_id_seq
    OWNED BY public.products.product_id;

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------
CREATE INDEX idx_products_barcode             ON public.products USING btree (barcode);
CREATE INDEX idx_products_description         ON public.products USING btree (description);
CREATE INDEX idx_products_is_active           ON public.products USING btree (is_active);
CREATE INDEX idx_products_manufacturer_id     ON public.products USING btree (manufacturer_id);
CREATE INDEX idx_products_product_group_id    ON public.products USING btree (product_group_id);
CREATE INDEX idx_products_product_imagem_id   ON public.products USING btree (product_imagem_id);
CREATE INDEX idx_products_product_location_id ON public.products USING btree (product_location_id);
CREATE INDEX idx_products_product_stock_id    ON public.products USING btree (product_stock_id);
CREATE INDEX idx_products_product_subgroup_id ON public.products USING btree (product_subgroup_id);
CREATE INDEX idx_products_supplier_id         ON public.products USING btree (supplier_id);

-- ------------------------------------------------------------
-- Triggers
-- ------------------------------------------------------------
CREATE TRIGGER audit_products_trigger
    AFTER INSERT OR DELETE OR UPDATE ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER trg_products_autogen_code
    BEFORE INSERT ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION products_autogen_code();

COMMIT;
```