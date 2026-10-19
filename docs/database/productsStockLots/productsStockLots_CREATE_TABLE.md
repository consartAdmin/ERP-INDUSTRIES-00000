```SQL

BEGIN;

-----------------------------------------------------------------------
-- Create the product stock lots table
-----------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS public."productsStockLots_lot_id_seq"
    AS BIGINT;

CREATE TABLE public."productsStockLots" (
    --------------------------------------------------------------------
    -- Identification and stock relationship
    --------------------------------------------------------------------
    lot_id BIGINT NOT NULL DEFAULT
        nextval('public."productsStockLots_lot_id_seq"'::regclass),

    product_stock_id BIGINT NOT NULL,
    product_grade_id INTEGER,

    --------------------------------------------------------------------
    -- Lot information
    --------------------------------------------------------------------
    lot_code   TEXT NOT NULL,
    expires_at DATE,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at TIMESTAMP WITHOUT TIME ZONE,

    --------------------------------------------------------------------
    -- Quantities
    --------------------------------------------------------------------
    qty_on_hand  NUMERIC(14,3) NOT NULL DEFAULT 0,
    qty_reserved NUMERIC(14,3) NOT NULL DEFAULT 0,

    --------------------------------------------------------------------
    -- Cost and source document
    --------------------------------------------------------------------
    cost_unit   NUMERIC(14,6),
    supplier_id BIGINT,
    nfe_key     TEXT,
    nfe_item_seq INTEGER,

    --------------------------------------------------------------------
    -- Audit
    --------------------------------------------------------------------
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),

    --------------------------------------------------------------------
    -- Primary key
    --------------------------------------------------------------------
    CONSTRAINT "productsStockLots_pkey"
        PRIMARY KEY (lot_id),

    --------------------------------------------------------------------
    -- Foreign keys
    --------------------------------------------------------------------
    CONSTRAINT "productsStockLots_product_stock_id_fkey"
        FOREIGN KEY (product_stock_id)
        REFERENCES public."productsStock" (product_stock_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_productsstocklots_product_grade
        FOREIGN KEY (product_grade_id)
        REFERENCES public."productsGrades" (product_grade_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    --------------------------------------------------------------------
    -- Quantity validations
    --------------------------------------------------------------------
    CONSTRAINT ck_psl_qty_nonneg
        CHECK (
            qty_on_hand >= 0
            AND qty_reserved >= 0
        ),

    CONSTRAINT ck_psl_reserved_le_onhand
        CHECK (qty_reserved <= qty_on_hand)
);

ALTER SEQUENCE public."productsStockLots_lot_id_seq"
    OWNED BY public."productsStockLots".lot_id;

-----------------------------------------------------------------------
-- Relationship and expiration indexes
-----------------------------------------------------------------------

CREATE INDEX idx_productsstocklots_product_grade_id
    ON public."productsStockLots" (product_grade_id);

CREATE INDEX idx_psl_expires
    ON public."productsStockLots" (expires_at);

-----------------------------------------------------------------------
-- Prevent duplicate active lots
-----------------------------------------------------------------------
-- Normalization rules:
--   * NULL grade is treated as grade 0;
--   * surrounding spaces are removed from the lot code;
--   * lot code comparison is case-insensitive;
--   * NULL expiration is treated as 9999-12-31.

CREATE UNIQUE INDEX ux_psl_stock_grade_lot_exp_active
    ON public."productsStockLots" (
        product_stock_id,
        COALESCE(product_grade_id, 0),
        LOWER(BTRIM(lot_code)),
        COALESCE(expires_at, DATE '9999-12-31')
    )
    WHERE COALESCE(is_active, TRUE) = TRUE;

CREATE UNIQUE INDEX ux_psl_stock_grade_lot_norm_active
    ON public."productsStockLots" (
        product_stock_id,
        COALESCE(product_grade_id, 0),
        LOWER(BTRIM(lot_code))
    )
    WHERE COALESCE(is_active, TRUE) = TRUE;

-----------------------------------------------------------------------
-- Automatically update updated_at
-----------------------------------------------------------------------
-- Prerequisite: public.set_updated_at() must already exist.

CREATE TRIGGER trg_productsstocklots_updated_at
BEFORE UPDATE ON public."productsStockLots"
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-----------------------------------------------------------------------
-- Recalculate the parent stock balance after lot changes
-----------------------------------------------------------------------
-- Prerequisite: public.trg_psl_recalc_stock() must already exist.

CREATE TRIGGER trg_psl_recalc_stock
AFTER INSERT OR DELETE OR UPDATE ON public."productsStockLots"
FOR EACH ROW
EXECUTE FUNCTION public.trg_psl_recalc_stock();

-----------------------------------------------------------------------
-- Tables that reference productsStockLots.lot_id
-----------------------------------------------------------------------
-- These foreign keys must be declared in the creation/migration scripts
-- of their respective tables:
--
--   public."budgetItens"        -> lot_id
--   public."budgetsItems"       -> lot_id, override_lot_id
--   public."ordersItems"        -> lot_id, override_lot_id
--   public."inboundInvoiceItems"-> lot_id
--   public."inventoryItems"     -> lot_id
--   public."nfeBonusItems"      -> lot_id
--   public."orderItems"         -> lot_id

COMMIT;

```