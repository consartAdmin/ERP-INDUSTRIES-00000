```sql

BEGIN;

-----------------------------------------------------------------------
-- Table: ordersNfeAttempts
-----------------------------------------------------------------------

CREATE TABLE public."ordersNfeAttempts" (
    attempt_id              BIGSERIAL PRIMARY KEY,

    order_id                BIGINT NOT NULL,
    budget_id               BIGINT,
    invoice_id              BIGINT,

    attempt_number          INTEGER NOT NULL DEFAULT 1,
    nfe_status_id           INTEGER NOT NULL,

    nfe_number              BIGINT,
    nfe_series              INTEGER,
    nfe_environment         VARCHAR(20),

    operation_type_id       BIGINT,

    customer_id             BIGINT,
    customer_name           VARCHAR(240),
    customer_tax_id         VARCHAR(30),
    customer_email          VARCHAR(180),
    customer_phone          VARCHAR(30),

    issue_date              DATE,

    subtotal                NUMERIC(14,2) NOT NULL DEFAULT 0,
    discount_total          NUMERIC(14,2) NOT NULL DEFAULT 0,
    freight_value           NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_amount            NUMERIC(14,2) NOT NULL DEFAULT 0,

    provider_id             VARCHAR(120),
    integration_id          VARCHAR(160),
    access_key              VARCHAR(44),
    protocol                VARCHAR(100),

    request_payload         JSONB,
    provider_response       JSONB,
    generated_xml           TEXT,

    error_code              VARCHAR(80),
    error_message           TEXT,

    requested_by            BIGINT,
    requested_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    authorized_at           TIMESTAMPTZ,
    rejected_at             TIMESTAMPTZ,
    last_checked_at         TIMESTAMPTZ,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -------------------------------------------------------------------
    -- Foreign Keys
    -------------------------------------------------------------------

    CONSTRAINT fk_order_nfe_attempt_order
        FOREIGN KEY (order_id)
        REFERENCES public.orders (order_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_order_nfe_attempt_budget
        FOREIGN KEY (budget_id)
        REFERENCES public.budgets (budget_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT fk_order_nfe_attempt_invoice
        FOREIGN KEY (invoice_id)
        REFERENCES public."invoicesIssued" (invoice_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT fk_order_nfe_attempt_status
        FOREIGN KEY (nfe_status_id)
        REFERENCES public."nfeStatusMap" (nfe_status_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_order_nfe_attempt_operation
        FOREIGN KEY (operation_type_id)
        REFERENCES public."nfeOperationTypes" (operation_type_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    -------------------------------------------------------------------
    -- Validation constraints
    -------------------------------------------------------------------

    CONSTRAINT ck_order_nfe_attempt_number
        CHECK (attempt_number > 0),

    CONSTRAINT ck_order_nfe_attempt_values
        CHECK (
            subtotal >= 0
            AND discount_total >= 0
            AND freight_value >= 0
            AND total_amount >= 0
        ),

    CONSTRAINT ck_order_nfe_attempt_environment
        CHECK (
            nfe_environment IS NULL
            OR nfe_environment IN ('HOMOLOGACAO', 'PRODUCAO')
        ),

    CONSTRAINT ck_order_nfe_attempt_access_key
        CHECK (
            access_key IS NULL
            OR BTRIM(access_key) = ''
            OR BTRIM(access_key) ~ '^[0-9]{44}$'
        ),

    -------------------------------------------------------------------
    -- One attempt number per order
    -------------------------------------------------------------------

    CONSTRAINT uq_order_nfe_attempt_number
        UNIQUE (order_id, attempt_number)
);

-----------------------------------------------------------------------
-- Unique provider ID
-----------------------------------------------------------------------

CREATE UNIQUE INDEX ux_order_nfe_attempt_provider
    ON public."ordersNfeAttempts" (provider_id)
    WHERE provider_id IS NOT NULL
      AND BTRIM(provider_id) <> '';

-----------------------------------------------------------------------
-- Unique integration ID
-----------------------------------------------------------------------

CREATE UNIQUE INDEX ux_order_nfe_attempt_integration
    ON public."ordersNfeAttempts" (integration_id)
    WHERE integration_id IS NOT NULL
      AND BTRIM(integration_id) <> '';

-----------------------------------------------------------------------
-- Unique NF-e access key
-----------------------------------------------------------------------

CREATE UNIQUE INDEX ux_order_nfe_attempt_access_key
    ON public."ordersNfeAttempts" (access_key)
    WHERE access_key IS NOT NULL
      AND BTRIM(access_key) <> '';

-----------------------------------------------------------------------
-- Useful indexes
-----------------------------------------------------------------------

CREATE INDEX ix_order_nfe_attempt_order
    ON public."ordersNfeAttempts" (order_id);

CREATE INDEX ix_order_nfe_attempt_budget
    ON public."ordersNfeAttempts" (budget_id);

CREATE INDEX ix_order_nfe_attempt_invoice
    ON public."ordersNfeAttempts" (invoice_id);

CREATE INDEX ix_order_nfe_attempt_status
    ON public."ordersNfeAttempts" (nfe_status_id);

CREATE INDEX ix_order_nfe_attempt_operation
    ON public."ordersNfeAttempts" (operation_type_id);

CREATE INDEX ix_order_nfe_attempt_requested_at
    ON public."ordersNfeAttempts" (requested_at DESC);

CREATE INDEX ix_order_nfe_attempt_order_requested
    ON public."ordersNfeAttempts" (order_id, requested_at DESC);

COMMIT;

```