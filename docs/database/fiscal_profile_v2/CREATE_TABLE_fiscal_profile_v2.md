```` SQL
BEGIN;

-- ------------------------------------------------------------
-- Table
-- ------------------------------------------------------------
CREATE TABLE public.fiscal_profile_v2 (
    fiscal_profile_id    integer                     NOT NULL GENERATED ALWAYS AS IDENTITY,
    profile_name         character varying(100)      NOT NULL,
    description          text,
    icms_cst             character varying(3),
    icms_rate            numeric(9,4)                NOT NULL DEFAULT 0,
    origin_code          character varying(2),
    cfop_entry           character varying(10),
    cfop_exit            character varying(10),
    pis_cst              character varying(3),
    pis_rate             numeric(9,4)                NOT NULL DEFAULT 0,
    cofins_cst           character varying(3),
    cofins_rate          numeric(9,4)                NOT NULL DEFAULT 0,
    benefit_code         character varying(20),
    is_active            boolean                     NOT NULL DEFAULT true,
    created_at           timestamp without time zone NOT NULL DEFAULT now(),
    updated_at           timestamp without time zone NOT NULL DEFAULT now(),
    icms_base_pct        numeric(9,4)                NOT NULL DEFAULT 100,
    mva_pct              numeric(9,4),
    icms_st_base_pct     numeric(9,4),
    icms_st_rate         numeric(9,4),
    icms_st_ret_base_pct numeric(9,4),
    icms_st_ret_rate     numeric(9,4),
    ipi_rate             numeric(9,4)                NOT NULL DEFAULT 0,

    CONSTRAINT fiscal_profile_v2_pk PRIMARY KEY (fiscal_profile_id),

    -- Required rates (0 to 100 %)
    CONSTRAINT fiscal_profile_v2_icms_rate_chk
        CHECK (icms_rate >= 0::numeric AND icms_rate <= 100::numeric),
    CONSTRAINT fiscal_profile_v2_icms_base_pct_chk
        CHECK (icms_base_pct >= 0::numeric AND icms_base_pct <= 100::numeric),
    CONSTRAINT fiscal_profile_v2_pis_rate_chk
        CHECK (pis_rate >= 0::numeric AND pis_rate <= 100::numeric),
    CONSTRAINT fiscal_profile_v2_cofins_rate_chk
        CHECK (cofins_rate >= 0::numeric AND cofins_rate <= 100::numeric),
    CONSTRAINT fiscal_profile_v2_ipi_rate_chk
        CHECK (ipi_rate >= 0::numeric AND ipi_rate <= 100::numeric),

    -- Optional ICMS ST values (NULL, or 0 to 100 %)
    CONSTRAINT fiscal_profile_v2_mva_pct_chk
        CHECK (mva_pct IS NULL OR mva_pct >= 0::numeric),
    CONSTRAINT fiscal_profile_v2_icms_st_base_pct_chk
        CHECK (icms_st_base_pct IS NULL OR (icms_st_base_pct >= 0::numeric AND icms_st_base_pct <= 100::numeric)),
    CONSTRAINT fiscal_profile_v2_icms_st_rate_chk
        CHECK (icms_st_rate IS NULL OR (icms_st_rate >= 0::numeric AND icms_st_rate <= 100::numeric)),
    CONSTRAINT fiscal_profile_v2_icms_st_ret_base_pct_chk
        CHECK (icms_st_ret_base_pct IS NULL OR (icms_st_ret_base_pct >= 0::numeric AND icms_st_ret_base_pct <= 100::numeric)),
    CONSTRAINT fiscal_profile_v2_icms_st_ret_rate_chk
        CHECK (icms_st_ret_rate IS NULL OR (icms_st_ret_rate >= 0::numeric AND icms_st_ret_rate <= 100::numeric))
);

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------
CREATE INDEX fiscal_profile_v2_active_idx
    ON public.fiscal_profile_v2 USING btree (is_active);

CREATE INDEX fiscal_profile_v2_cfop_entry_idx
    ON public.fiscal_profile_v2 USING btree (cfop_entry);

CREATE INDEX fiscal_profile_v2_cfop_exit_idx
    ON public.fiscal_profile_v2 USING btree (cfop_exit);

CREATE INDEX fiscal_profile_v2_icms_idx
    ON public.fiscal_profile_v2 USING btree (icms_cst, origin_code);

-- Profile names are unique, case-insensitive
CREATE UNIQUE INDEX fiscal_profile_v2_name_unique
    ON public.fiscal_profile_v2 USING btree (lower(profile_name::text));

-- ------------------------------------------------------------
-- Triggers
-- ------------------------------------------------------------
CREATE TRIGGER fiscal_profile_v2_updated_at
    BEFORE UPDATE ON public.fiscal_profile_v2
    FOR EACH ROW
    EXECUTE FUNCTION set_timestamp();

COMMIT;

````