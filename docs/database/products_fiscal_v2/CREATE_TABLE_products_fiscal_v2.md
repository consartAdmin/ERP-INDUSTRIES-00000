``` SQL

BEGIN;

-- ------------------------------------------------------------
-- Table
-- ------------------------------------------------------------
CREATE TABLE public."productsFiscalV2" (
    products_fiscal_id       bigint                   NOT NULL GENERATED ALWAYS AS IDENTITY,
    product_code             character varying(60)    NOT NULL,
    fiscal_classification_id integer                  NOT NULL,
    effective_from           timestamp with time zone NOT NULL DEFAULT now(),
    effective_to             timestamp with time zone,
    version                  integer                  NOT NULL DEFAULT 1,
    is_current               boolean                  NOT NULL DEFAULT true,
    is_active                boolean                  NOT NULL DEFAULT true,
    source_system            character varying(60),
    source_reference         character varying(120),
    extra_payload            jsonb                    NOT NULL DEFAULT '{}'::jsonb,
    created_at               timestamp with time zone NOT NULL DEFAULT now(),
    updated_at               timestamp with time zone NOT NULL DEFAULT now(),

    CONSTRAINT products_fiscal_v2_pk PRIMARY KEY (products_fiscal_id),

    CONSTRAINT products_fiscal_v2_dates_chk
        CHECK (effective_to IS NULL OR effective_to >= effective_from),
    CONSTRAINT products_fiscal_v2_extra_payload_chk
        CHECK (jsonb_typeof(extra_payload) = 'object'::text),
    CONSTRAINT products_fiscal_v2_version_chk
        CHECK (version > 0),

    CONSTRAINT products_fiscal_v2_classification_fk FOREIGN KEY (fiscal_classification_id)
        REFERENCES public.fiscal_classification_v2 (fiscal_classification_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------
CREATE INDEX products_fiscal_v2_classification_idx
    ON public."productsFiscalV2" USING btree (fiscal_classification_id);

CREATE INDEX products_fiscal_v2_product_idx
    ON public."productsFiscalV2" USING btree (product_code);

-- Only one current + active fiscal row per product
CREATE UNIQUE INDEX products_fiscal_v2_current_product_ux
    ON public."productsFiscalV2" USING btree (product_code)
    WHERE is_current = true AND is_active = true;

-- ------------------------------------------------------------
-- Triggers
-- ------------------------------------------------------------
CREATE TRIGGER products_fiscal_v2_updated_at
    BEFORE UPDATE ON public."productsFiscalV2"
    FOR EACH ROW
    EXECUTE FUNCTION set_timestamp();

COMMIT;

```