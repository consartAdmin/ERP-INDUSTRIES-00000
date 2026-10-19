```SQL

BEGIN;

CREATE TABLE IF NOT EXISTS public."ordersNfeAttemptItems" (
    --------------------------------------------------------------------
    -- Primary identification
    --------------------------------------------------------------------
    attempt_item_id BIGINT GENERATED ALWAYS AS IDENTITY,
    attempt_id      BIGINT NOT NULL,
    order_item_id   BIGINT,
    item_number     INTEGER NOT NULL,

    --------------------------------------------------------------------
    -- Product identification
    --------------------------------------------------------------------
    product_id      BIGINT,
    product_code    VARCHAR(60) NOT NULL,
    barcode         VARCHAR(30),
    description     VARCHAR(500) NOT NULL,

    --------------------------------------------------------------------
    -- Fiscal source used during the attempt
    --------------------------------------------------------------------
    products_fiscal_id       BIGINT,
    fiscal_classification_id INTEGER,
    fiscal_profile_id        INTEGER,

    fiscal_version           INTEGER,
    fiscal_effective_from    TIMESTAMPTZ,
    fiscal_effective_to      TIMESTAMPTZ,
    fiscal_source_system     VARCHAR(60),
    fiscal_source_reference  VARCHAR(120),

    --------------------------------------------------------------------
    -- Fiscal classification snapshot
    --------------------------------------------------------------------
    classification_name        VARCHAR(150),
    classification_description TEXT,

    ncm_code                   VARCHAR(10),
    ncm_description            TEXT,
    ex_tipi                     VARCHAR(3),
    cest_code                   VARCHAR(10),
    cest_description            TEXT,

    --------------------------------------------------------------------
    -- Commercial/fiscal units
    --------------------------------------------------------------------
    commercial_unit       VARCHAR(10),
    taxable_unit          VARCHAR(10),
    is_unit               VARCHAR(6),

    --------------------------------------------------------------------
    -- Item quantities and commercial values
    --------------------------------------------------------------------
    quantity              NUMERIC(18,6) NOT NULL DEFAULT 0,
    taxable_quantity      NUMERIC(18,6),

    unit_price            NUMERIC(18,10) NOT NULL DEFAULT 0,
    taxable_unit_price    NUMERIC(18,10),

    gross_total           NUMERIC(18,4) NOT NULL DEFAULT 0,
    discount_amount       NUMERIC(18,4) NOT NULL DEFAULT 0,
    freight_amount        NUMERIC(18,4) NOT NULL DEFAULT 0,
    insurance_amount      NUMERIC(18,4) NOT NULL DEFAULT 0,
    other_expenses_amount NUMERIC(18,4) NOT NULL DEFAULT 0,
    net_total             NUMERIC(18,4) NOT NULL DEFAULT 0,

    included_in_invoice_total BOOLEAN NOT NULL DEFAULT TRUE,

    --------------------------------------------------------------------
    -- Lot and stock traceability
    --------------------------------------------------------------------
    product_stock_id   BIGINT,
    lot_id             BIGINT,
    lot_number         VARCHAR(100),
    manufacturing_date DATE,
    expiration_date    DATE,

    --------------------------------------------------------------------
    -- Fiscal profile snapshot
    --------------------------------------------------------------------
    fiscal_profile_name        VARCHAR(100),
    fiscal_profile_description TEXT,

    origin_code  VARCHAR(2),
    icms_cst     VARCHAR(3),
    icms_rate    NUMERIC(9,4) NOT NULL DEFAULT 0,

    cfop_entry   VARCHAR(10),
    cfop_exit    VARCHAR(10),
    cfop_used    VARCHAR(10),

    pis_cst      VARCHAR(3),
    pis_rate     NUMERIC(9,4) NOT NULL DEFAULT 0,

    cofins_cst   VARCHAR(3),
    cofins_rate  NUMERIC(9,4) NOT NULL DEFAULT 0,

    benefit_code VARCHAR(20),

    --------------------------------------------------------------------
    -- Calculated ICMS values
    --------------------------------------------------------------------
    icms_base               NUMERIC(18,4) NOT NULL DEFAULT 0,
    icms_base_reduction_pct NUMERIC(9,4)  NOT NULL DEFAULT 0,
    icms_effective_rate     NUMERIC(9,4)  NOT NULL DEFAULT 0,
    icms_value              NUMERIC(18,4) NOT NULL DEFAULT 0,

    --------------------------------------------------------------------
    -- Calculated ICMS-ST values
    --------------------------------------------------------------------
    icms_st_modality           VARCHAR(2),
    icms_st_mva_pct            NUMERIC(9,4)  NOT NULL DEFAULT 0,
    icms_st_base_reduction_pct NUMERIC(9,4)  NOT NULL DEFAULT 0,
    icms_st_base               NUMERIC(18,4) NOT NULL DEFAULT 0,
    icms_st_rate               NUMERIC(9,4)  NOT NULL DEFAULT 0,
    icms_st_value              NUMERIC(18,4) NOT NULL DEFAULT 0,

    icms_st_retained_base      NUMERIC(18,4) NOT NULL DEFAULT 0,
    icms_st_retained_rate      NUMERIC(9,4)  NOT NULL DEFAULT 0,
    icms_st_retained_value     NUMERIC(18,4) NOT NULL DEFAULT 0,

    --------------------------------------------------------------------
    -- FCP values
    --------------------------------------------------------------------
    fcp_base             NUMERIC(18,4) NOT NULL DEFAULT 0,
    fcp_rate             NUMERIC(9,4)  NOT NULL DEFAULT 0,
    fcp_value            NUMERIC(18,4) NOT NULL DEFAULT 0,

    fcp_st_base          NUMERIC(18,4) NOT NULL DEFAULT 0,
    fcp_st_rate          NUMERIC(9,4)  NOT NULL DEFAULT 0,
    fcp_st_value         NUMERIC(18,4) NOT NULL DEFAULT 0,

    --------------------------------------------------------------------
    -- Calculated PIS values
    --------------------------------------------------------------------
    pis_base             NUMERIC(18,4) NOT NULL DEFAULT 0,
    pis_effective_rate   NUMERIC(9,4)  NOT NULL DEFAULT 0,
    pis_value            NUMERIC(18,4) NOT NULL DEFAULT 0,

    --------------------------------------------------------------------
    -- Calculated COFINS values
    --------------------------------------------------------------------
    cofins_base           NUMERIC(18,4) NOT NULL DEFAULT 0,
    cofins_effective_rate NUMERIC(9,4)  NOT NULL DEFAULT 0,
    cofins_value          NUMERIC(18,4) NOT NULL DEFAULT 0,

    --------------------------------------------------------------------
    -- Selective Tax configuration from fiscal_classification_v2
    --------------------------------------------------------------------
    is_cst             VARCHAR(3),
    is_classification  VARCHAR(10),
    is_rate            NUMERIC(9,4)  NOT NULL DEFAULT 0,
    is_specific_rate   NUMERIC(15,6) NOT NULL DEFAULT 0,

    --------------------------------------------------------------------
    -- Calculated Selective Tax values
    --------------------------------------------------------------------
    is_base             NUMERIC(18,4) NOT NULL DEFAULT 0,
    is_quantity         NUMERIC(18,6) NOT NULL DEFAULT 0,
    is_value            NUMERIC(18,4) NOT NULL DEFAULT 0,

    --------------------------------------------------------------------
    -- IBS/CBS configuration from fiscal_classification_v2
    --------------------------------------------------------------------
    ibscbs_cst            VARCHAR(3),
    ibscbs_classification VARCHAR(6),

    ibs_uf_rate           NUMERIC(9,4) NOT NULL DEFAULT 0,
    ibs_municipal_rate    NUMERIC(9,4) NOT NULL DEFAULT 0,
    cbs_rate              NUMERIC(9,4) NOT NULL DEFAULT 0,

    donation_indicator    SMALLINT NOT NULL DEFAULT 1,

    --------------------------------------------------------------------
    -- Calculated IBS/CBS values used in the NF-e
    --------------------------------------------------------------------
    ibscbs_base             NUMERIC(18,4) NOT NULL DEFAULT 0,

    ibs_uf_effective_rate   NUMERIC(9,4)  NOT NULL DEFAULT 0,
    ibs_uf_value            NUMERIC(18,4) NOT NULL DEFAULT 0,

    ibs_municipal_effective_rate
                             NUMERIC(9,4)  NOT NULL DEFAULT 0,
    ibs_municipal_value      NUMERIC(18,4) NOT NULL DEFAULT 0,

    ibs_total_value          NUMERIC(18,4) NOT NULL DEFAULT 0,

    cbs_effective_rate       NUMERIC(9,4)  NOT NULL DEFAULT 0,
    cbs_value                NUMERIC(18,4) NOT NULL DEFAULT 0,

    --------------------------------------------------------------------
    -- Complete immutable snapshots
    --------------------------------------------------------------------
    product_fiscal_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
    classification_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
    fiscal_profile_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,

    tax_reform_details      JSONB NOT NULL DEFAULT '{}'::JSONB,
    tax_calculation         JSONB NOT NULL DEFAULT '{}'::JSONB,

    order_item_snapshot    JSONB NOT NULL DEFAULT '{}'::JSONB,
    provider_item_payload   JSONB NOT NULL DEFAULT '{}'::JSONB,

    --------------------------------------------------------------------
    -- Audit
    --------------------------------------------------------------------
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    --------------------------------------------------------------------
    -- Constraints
    --------------------------------------------------------------------
    CONSTRAINT "ordersNfeAttemptItems_pkey"
        PRIMARY KEY (attempt_item_id),

    CONSTRAINT "fk_ordersNfeAttemptItems_attempt"
        FOREIGN KEY (attempt_id)
        REFERENCES public."ordersNfeAttempts" (attempt_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT "fk_ordersNfeAttemptItems_product_fiscal"
        FOREIGN KEY (products_fiscal_id)
        REFERENCES public."productsFiscalV2" (products_fiscal_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT "fk_ordersNfeAttemptItems_classification"
        FOREIGN KEY (fiscal_classification_id)
        REFERENCES public.fiscal_classification_v2 (
            fiscal_classification_id
        )
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT "fk_ordersNfeAttemptItems_profile"
        FOREIGN KEY (fiscal_profile_id)
        REFERENCES public.fiscal_profile_v2 (fiscal_profile_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT "uq_ordersNfeAttemptItems_number"
        UNIQUE (attempt_id, item_number),

    CONSTRAINT "ck_ordersNfeAttemptItems_item_number"
        CHECK (item_number > 0),

    CONSTRAINT "ck_ordersNfeAttemptItems_quantity"
        CHECK (quantity >= 0),

    CONSTRAINT "ck_ordersNfeAttemptItems_taxable_quantity"
        CHECK (
            taxable_quantity IS NULL
            OR taxable_quantity >= 0
        ),

    CONSTRAINT "ck_ordersNfeAttemptItems_unit_price"
        CHECK (unit_price >= 0),

    CONSTRAINT "ck_ordersNfeAttemptItems_values"
        CHECK (
            gross_total >= 0
            AND discount_amount >= 0
            AND freight_amount >= 0
            AND insurance_amount >= 0
            AND other_expenses_amount >= 0
            AND net_total >= 0
        ),

    CONSTRAINT "ck_ordersNfeAttemptItems_donation"
        CHECK (donation_indicator IN (0, 1)),

    CONSTRAINT "ck_ordersNfeAttemptItems_json"
        CHECK (
            jsonb_typeof(product_fiscal_snapshot) = 'object'
            AND jsonb_typeof(classification_snapshot) = 'object'
            AND jsonb_typeof(fiscal_profile_snapshot) = 'object'
            AND jsonb_typeof(tax_reform_details) = 'object'
            AND jsonb_typeof(tax_calculation) = 'object'
            AND jsonb_typeof(order_item_snapshot) = 'object'
            AND jsonb_typeof(provider_item_payload) = 'object'
        )
);

-----------------------------------------------------------------------
-- Indexes
-----------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS "idx_ordersNfeAttemptItems_attempt"
    ON public."ordersNfeAttemptItems" (attempt_id);

CREATE INDEX IF NOT EXISTS "idx_ordersNfeAttemptItems_order_item"
    ON public."ordersNfeAttemptItems" (order_item_id)
    WHERE order_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_ordersNfeAttemptItems_product_code"
    ON public."ordersNfeAttemptItems" (product_code);

CREATE INDEX IF NOT EXISTS "idx_ordersNfeAttemptItems_product_fiscal"
    ON public."ordersNfeAttemptItems" (products_fiscal_id)
    WHERE products_fiscal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_ordersNfeAttemptItems_classification"
    ON public."ordersNfeAttemptItems" (fiscal_classification_id)
    WHERE fiscal_classification_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_ordersNfeAttemptItems_profile"
    ON public."ordersNfeAttemptItems" (fiscal_profile_id)
    WHERE fiscal_profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_ordersNfeAttemptItems_lot"
    ON public."ordersNfeAttemptItems" (lot_id)
    WHERE lot_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_ordersNfeAttemptItems_ncm"
    ON public."ordersNfeAttemptItems" (ncm_code)
    WHERE ncm_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_ordersNfeAttemptItems_cfop"
    ON public."ordersNfeAttemptItems" (cfop_used)
    WHERE cfop_used IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_ordersNfeAttemptItems_ibscbs"
    ON public."ordersNfeAttemptItems" (
        ibscbs_cst,
        ibscbs_classification
    );

COMMIT;

```