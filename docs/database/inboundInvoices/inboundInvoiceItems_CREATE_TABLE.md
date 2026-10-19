```SQL

CREATE TABLE public."inboundInvoiceItems"
(
    -- Identificação e relacionamento
    inbound_item_id         INTEGER GENERATED ALWAYS AS IDENTITY,
    inbound_id              INTEGER NOT NULL,
    nfe_item_seq            INTEGER NOT NULL,

    -- Produto interno e referência original do fornecedor
    product_id              INTEGER,
    product_code            VARCHAR(50),
    nf_product_code         VARCHAR(60) NOT NULL,
    barcode                 VARCHAR(14),
    manufacturer_ref        VARCHAR(60),
    description             TEXT NOT NULL,
    ncm                     VARCHAR(20),
    cest                    VARCHAR(10),
    benefit_code            VARCHAR(20),
    cfop                    VARCHAR(10),
    lot_id                  BIGINT,
    product_grade_id        INTEGER,

    -- Quantidade e unidade legadas
    unit                    VARCHAR(10) NOT NULL,
    quantity                NUMERIC(12,4) NOT NULL,
    unit_price              NUMERIC(12,4) NOT NULL,
    total_price             NUMERIC(12,2) NOT NULL,

    -- Valores comerciais originais da NF-e
    commercial_unit         VARCHAR(10),
    commercial_quantity     NUMERIC(15,4),
    commercial_unit_price   NUMERIC(15,10),

    -- Valores tributáveis originais da NF-e
    taxable_unit            VARCHAR(10),
    taxable_quantity        NUMERIC(15,4),
    taxable_unit_price      NUMERIC(15,10),
    conversion_factor       NUMERIC(15,8) NOT NULL DEFAULT 1,

    -- Composição financeira do item
    gross_total             NUMERIC(15,2) NOT NULL DEFAULT 0,
    discount_value          NUMERIC(15,2) NOT NULL DEFAULT 0,
    freight_value           NUMERIC(15,2) NOT NULL DEFAULT 0,
    insurance_value         NUMERIC(15,2) NOT NULL DEFAULT 0,
    other_expenses          NUMERIC(15,2) NOT NULL DEFAULT 0,
    net_total               NUMERIC(15,2) NOT NULL DEFAULT 0,

    -- Campos legados preservados até a atualização completa do backend
    ipi                     NUMERIC(12,2) NOT NULL DEFAULT 0,
    icms                    NUMERIC(12,2) NOT NULL DEFAULT 0,

    -- ICMS
    icms_origin             VARCHAR(1),
    icms_cst                VARCHAR(3),
    icms_modality           VARCHAR(2),
    icms_base               NUMERIC(15,2),
    icms_reduction_rate     NUMERIC(9,4),
    icms_rate               NUMERIC(9,4),
    icms_value              NUMERIC(15,2),
    icms_st_modality        VARCHAR(2),
    icms_st_mva_rate        NUMERIC(9,4),
    icms_st_reduction_rate  NUMERIC(9,4),
    icms_st_base            NUMERIC(15,2),
    icms_st_rate            NUMERIC(9,4),
    icms_st_value           NUMERIC(15,2),

    -- Fundo de Combate à Pobreza
    fcp_base                NUMERIC(15,2),
    fcp_rate                NUMERIC(9,4),
    fcp_value               NUMERIC(15,2),
    fcp_st_base             NUMERIC(15,2),
    fcp_st_rate             NUMERIC(9,4),
    fcp_st_value            NUMERIC(15,2),

    -- IPI
    ipi_cst                 VARCHAR(3),
    ipi_base                NUMERIC(15,2),
    ipi_rate                NUMERIC(9,4),
    ipi_value               NUMERIC(15,2),

    -- PIS
    pis_cst                 VARCHAR(3),
    pis_base                NUMERIC(15,2),
    pis_rate                NUMERIC(9,4),
    pis_value               NUMERIC(15,2),

    -- COFINS
    cofins_cst              VARCHAR(3),
    cofins_base             NUMERIC(15,2),
    cofins_rate             NUMERIC(9,4),
    cofins_value            NUMERIC(15,2),

    -- Reforma tributária: IBS e CBS
    ibs_cst                 VARCHAR(3),
    ibs_classification_code VARCHAR(20),
    ibs_base                NUMERIC(15,2),
    ibs_state_rate          NUMERIC(9,4),
    ibs_state_value         NUMERIC(15,2),
    ibs_city_rate           NUMERIC(9,4),
    ibs_city_value          NUMERIC(15,2),
    ibs_value               NUMERIC(15,2),

    cbs_cst                 VARCHAR(3),
    cbs_classification_code VARCHAR(20),
    cbs_base                NUMERIC(15,2),
    cbs_rate                NUMERIC(9,4),
    cbs_value               NUMERIC(15,2),

    -- Rastreabilidade fiscal
    nfe_key                 VARCHAR(44),
    raw_product_payload     JSONB,
    raw_tax_payload         JSONB,
    created_at              TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT inbound_invoice_items_new_pkey
        PRIMARY KEY (inbound_item_id),

    CONSTRAINT inbound_invoice_items_new_invoice_sequence_uk
        UNIQUE (inbound_id, nfe_item_seq),

    CONSTRAINT inbound_invoice_items_new_inbound_id_fkey
        FOREIGN KEY (inbound_id)
        REFERENCES public."inboundInvoices" (inbound_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT inbound_invoice_items_new_lot_id_fkey
        FOREIGN KEY (lot_id)
        REFERENCES public."productsStockLots" (lot_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT inbound_invoice_items_new_sequence_ck
        CHECK (nfe_item_seq > 0),

    CONSTRAINT inbound_invoice_items_new_quantity_ck
        CHECK (quantity >= 0),

    CONSTRAINT inbound_invoice_items_new_conversion_ck
        CHECK (conversion_factor > 0)
);

```