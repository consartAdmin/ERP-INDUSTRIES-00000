``` SQL

BEGIN;

-- ------------------------------------------------------------
-- Table
-- ------------------------------------------------------------
CREATE TABLE public.fiscal_classification_v2 (
    fiscal_classification_id integer                     NOT NULL GENERATED ALWAYS AS IDENTITY,
    classification_name      character varying(150)      NOT NULL,
    description              text,

    -- NCM / EX TIPI / CEST
    ncm_code                 character varying(10),
    ncm_description          text,
    ex_tipi                  character varying(3),
    cest_code                character varying(10),
    cest_description         text,

    fiscal_profile_id        integer,

    -- Imposto Seletivo (IS)
    is_cst                   character varying(3),
    is_classification        character varying(10),
    is_rate                  numeric(9,4)                NOT NULL DEFAULT 0,
    is_specific_rate         numeric(15,6)               NOT NULL DEFAULT 0,
    is_unit                  character varying(6)        NOT NULL DEFAULT 'UN'::character varying,

    -- IBS / CBS (tax reform)
    ibscbs_cst               character varying(3),
    ibscbs_classification    character varying(6),
    ibs_uf_rate              numeric(9,4)                NOT NULL DEFAULT 0,
    ibs_municipal_rate       numeric(9,4)                NOT NULL DEFAULT 0,
    cbs_rate                 numeric(9,4)                NOT NULL DEFAULT 0,
    donation_indicator       smallint                    NOT NULL DEFAULT 1,
    tax_reform_details       jsonb                       NOT NULL DEFAULT '{}'::jsonb,

    is_active                boolean                     NOT NULL DEFAULT true,
    created_at               timestamp without time zone NOT NULL DEFAULT now(),
    updated_at               timestamp without time zone NOT NULL DEFAULT now(),

    CONSTRAINT fiscal_classification_v2_pk PRIMARY KEY (fiscal_classification_id),

    -- Code formats
    CONSTRAINT fiscal_classification_v2_ncm_format_chk
        CHECK (ncm_code IS NULL
               OR regexp_replace(ncm_code::text, '[^0-9]'::text, ''::text, 'g'::text) ~ '^[0-9]{8}$'::text),
    CONSTRAINT fiscal_classification_v2_cest_format_chk
        CHECK (cest_code IS NULL
               OR regexp_replace(cest_code::text, '[^0-9]'::text, ''::text, 'g'::text) ~ '^[0-9]{7}$'::text),
    CONSTRAINT fiscal_classification_v2_ibscbs_cst_chk
        CHECK (ibscbs_cst IS NULL OR ibscbs_cst::text ~ '^[0-9]{3}$'::text),
    CONSTRAINT fiscal_classification_v2_ibscbs_classification_chk
        CHECK (ibscbs_classification IS NULL OR ibscbs_classification::text ~ '^[0-9]{6}$'::text),

    -- Rates (0 to 100 %)
    CONSTRAINT fiscal_classification_v2_is_rate_chk
        CHECK (is_rate >= 0::numeric AND is_rate <= 100::numeric),
    CONSTRAINT fiscal_classification_v2_ibs_uf_rate_chk
        CHECK (ibs_uf_rate >= 0::numeric AND ibs_uf_rate <= 100::numeric),
    CONSTRAINT fiscal_classification_v2_ibs_municipal_rate_chk
        CHECK (ibs_municipal_rate >= 0::numeric AND ibs_municipal_rate <= 100::numeric),
    CONSTRAINT fiscal_classification_v2_cbs_rate_chk
        CHECK (cbs_rate >= 0::numeric AND cbs_rate <= 100::numeric),

    -- Other
    CONSTRAINT fiscal_classification_v2_donation_chk
        CHECK (donation_indicator = ANY (ARRAY[0, 1])),
    CONSTRAINT fiscal_classification_v2_details_object_chk
        CHECK (jsonb_typeof(tax_reform_details) = 'object'::text),

    CONSTRAINT fiscal_classification_v2_profile_fk FOREIGN KEY (fiscal_profile_id)
        REFERENCES public.fiscal_profile_v2 (fiscal_profile_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------
CREATE INDEX fiscal_classification_v2_active_idx
    ON public.fiscal_classification_v2 USING btree (is_active);

CREATE INDEX fiscal_classification_v2_cest_idx
    ON public.fiscal_classification_v2 USING btree (cest_code);

CREATE INDEX fiscal_classification_v2_ibscbs_class_idx
    ON public.fiscal_classification_v2 USING btree (ibscbs_classification);

CREATE INDEX fiscal_classification_v2_ibscbs_cst_idx
    ON public.fiscal_classification_v2 USING btree (ibscbs_cst);

CREATE INDEX fiscal_classification_v2_ncm_idx
    ON public.fiscal_classification_v2 USING btree (ncm_code);

CREATE INDEX fiscal_classification_v2_profile_idx
    ON public.fiscal_classification_v2 USING btree (fiscal_profile_id);

-- Classification names are unique, case-insensitive
CREATE UNIQUE INDEX fiscal_classification_v2_name_unique
    ON public.fiscal_classification_v2 USING btree (lower(classification_name::text));

-- ------------------------------------------------------------
-- Triggers
-- ------------------------------------------------------------
CREATE TRIGGER fiscal_classification_v2_updated_at
    BEFORE UPDATE ON public.fiscal_classification_v2
    FOR EACH ROW
    EXECUTE FUNCTION set_timestamp();

COMMIT;

```