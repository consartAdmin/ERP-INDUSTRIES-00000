```SQL

CREATE TABLE public."inboundInvoiceInstallments"
(
    inbound_installment_id INTEGER GENERATED ALWAYS AS IDENTITY,
    inbound_id             INTEGER NOT NULL,

    installment_number     INTEGER NOT NULL,
    installment_code       VARCHAR(20) NOT NULL,

    due_date               DATE NOT NULL,
    original_due_date      DATE,

    amount                 NUMERIC(15,2) NOT NULL,
    paid_amount            NUMERIC(15,2) NOT NULL DEFAULT 0,

    status                 VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    is_paid                BOOLEAN NOT NULL DEFAULT FALSE,
    paid_at                TIMESTAMP WITHOUT TIME ZONE,

    accounts_payable_id    INTEGER,

    created_at             TIMESTAMP WITHOUT TIME ZONE
                           NOT NULL DEFAULT NOW(),

    updated_at             TIMESTAMP WITHOUT TIME ZONE
                           NOT NULL DEFAULT NOW(),

    CONSTRAINT inbound_invoice_installments_pkey
        PRIMARY KEY (inbound_installment_id),

    CONSTRAINT inbound_invoice_installments_inbound_id_fkey
        FOREIGN KEY (inbound_id)
        REFERENCES public."inboundInvoices" (inbound_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT inbound_invoice_installments_sequence_uk
        UNIQUE (inbound_id, installment_number),

    CONSTRAINT inbound_invoice_installments_code_uk
        UNIQUE (inbound_id, installment_code),

    CONSTRAINT inbound_invoice_installments_number_ck
        CHECK (installment_number > 0),

    CONSTRAINT inbound_invoice_installments_amount_ck
        CHECK (amount >= 0),

    CONSTRAINT inbound_invoice_installments_paid_amount_ck
        CHECK (
            paid_amount >= 0
            AND paid_amount <= amount
        ),

    CONSTRAINT inbound_invoice_installments_status_ck
        CHECK (
            status IN (
                'PENDING',
                'PARTIAL',
                'PAID',
                'CANCELLED'
            )
        )
);

```