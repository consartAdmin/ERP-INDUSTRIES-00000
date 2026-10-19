```SQL

BEGIN;

-----------------------------------------------------------------------
-- Create orders shipping table
-----------------------------------------------------------------------

CREATE TABLE public."ordersShipping" (
    --------------------------------------------------------------------
    -- Identification
    --------------------------------------------------------------------
    order_shipping_id SERIAL,

    --------------------------------------------------------------------
    -- Freight
    --------------------------------------------------------------------
    freight_mode  SMALLINT NOT NULL DEFAULT 9,
    freight_value NUMERIC(12,2) NOT NULL DEFAULT 0,

    --------------------------------------------------------------------
    -- Carrier
    --------------------------------------------------------------------
    carrier_name     TEXT,
    carrier_cnpj_cpf VARCHAR(14),
    carrier_ie       VARCHAR(20),
    carrier_address  TEXT,
    carrier_city     TEXT,
    carrier_uf       CHAR(2),

    --------------------------------------------------------------------
    -- Vehicle / transport
    --------------------------------------------------------------------
    antt_code     VARCHAR(20),
    vehicle_plate VARCHAR(8),
    vehicle_uf    CHAR(2),

    --------------------------------------------------------------------
    -- Volumes
    --------------------------------------------------------------------
    volume_quantity  INTEGER,
    volume_species   TEXT,
    volume_brand     TEXT,
    volume_numbering TEXT,

    --------------------------------------------------------------------
    -- Weight
    --------------------------------------------------------------------
    gross_weight NUMERIC(12,3),
    net_weight   NUMERIC(12,3),

    --------------------------------------------------------------------
    -- Audit
    --------------------------------------------------------------------
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    --------------------------------------------------------------------
    -- Primary key
    --------------------------------------------------------------------
    CONSTRAINT orders_shipping_pkey
        PRIMARY KEY (order_shipping_id),

    --------------------------------------------------------------------
    -- Validation
    --------------------------------------------------------------------
    CONSTRAINT ck_orders_shipping_freight_mode
        CHECK (
            freight_mode IN (
                0,
                1,
                2,
                3,
                4,
                9
            )
        ),

    CONSTRAINT ck_orders_shipping_cnpj_cpf
        CHECK (
            carrier_cnpj_cpf IS NULL
            OR carrier_cnpj_cpf ~ '^[0-9]{11}$'
            OR carrier_cnpj_cpf ~ '^[0-9]{14}$'
        ),

    CONSTRAINT ck_orders_shipping_carrier_uf
        CHECK (
            carrier_uf IS NULL
            OR carrier_uf ~ '^[A-Z]{2}$'
        ),

    CONSTRAINT ck_orders_shipping_vehicle_uf
        CHECK (
            vehicle_uf IS NULL
            OR vehicle_uf ~ '^[A-Z]{2}$'
        ),

    CONSTRAINT ck_orders_shipping_freight_value
        CHECK (
            freight_value >= 0
        ),

    CONSTRAINT ck_orders_shipping_volume_quantity
        CHECK (
            volume_quantity IS NULL
            OR volume_quantity >= 0
        ),

    CONSTRAINT ck_orders_shipping_weights
        CHECK (
            (gross_weight IS NULL OR gross_weight >= 0)
            AND
            (net_weight IS NULL OR net_weight >= 0)
        )
);

-----------------------------------------------------------------------
-- Search indexes
-----------------------------------------------------------------------

CREATE INDEX idx_orders_shipping_carrier_name
    ON public."ordersShipping" (LOWER(carrier_name))
    WHERE carrier_name IS NOT NULL;

CREATE INDEX idx_orders_shipping_carrier_cnpj_cpf
    ON public."ordersShipping" (carrier_cnpj_cpf)
    WHERE carrier_cnpj_cpf IS NOT NULL;

CREATE INDEX idx_orders_shipping_vehicle_plate
    ON public."ordersShipping" (vehicle_plate)
    WHERE vehicle_plate IS NOT NULL;

-----------------------------------------------------------------------
-- updated_at trigger function
-----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at_orders_shipping()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_orders_shipping_updated_at
BEFORE UPDATE ON public."ordersShipping"
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_orders_shipping();

COMMIT;

```