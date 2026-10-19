```SQL
BEGIN;

CREATE TABLE public."inboundInvoices"
(
    inbound_id       INTEGER GENERATED ALWAYS AS IDENTITY,
    access_key       CHARACTER(44) NOT NULL,
    invoice_number   VARCHAR(20) NOT NULL,
    series           VARCHAR(5) NOT NULL,
    issuer            VARCHAR(18) NOT NULL,
    recipient         VARCHAR(18) NOT NULL,
    issue_date        DATE,
    entry_date        DATE,
    total_amount      NUMERIC(12,2) NOT NULL,
    status            VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    stock_applied     BOOLEAN NOT NULL DEFAULT FALSE,
    stock_applied_at  TIMESTAMP WITHOUT TIME ZONE,
    xml_url           TEXT,
    danfe_url         TEXT,
    created_at        TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT inbound_invoices_pkey
        PRIMARY KEY (inbound_id),

    CONSTRAINT inbound_invoices_access_key_uk
        UNIQUE (access_key),

    CONSTRAINT inbound_invoices_access_key_len_ck
        CHECK (char_length(access_key::text) = 44)
);

CREATE TRIGGER audit_inbound_invoices_trigger
AFTER INSERT OR DELETE OR UPDATE
ON public."inboundInvoices"
FOR EACH ROW
EXECUTE FUNCTION audit_trigger_function_by_id();

COMMIT;




ALTER TABLE public."accountsPayable"
ADD CONSTRAINT fk_accounts_payable_inbound
FOREIGN KEY (inbound_invoice_id)
REFERENCES public."inboundInvoices" (inbound_id)
ON UPDATE CASCADE
ON DELETE SET NULL;


ALTER TABLE public."inboundInvoiceInstallments"
ADD CONSTRAINT inbound_invoice_installments_invoice_id_fkey
FOREIGN KEY (invoice_id)
REFERENCES public."inboundInvoices" (inbound_id)
ON UPDATE CASCADE
ON DELETE CASCADE;



ALTER TABLE public."inboundInvoiceItems"
ADD CONSTRAINT inbound_invoice_items_invoice_id_fkey
FOREIGN KEY (invoice_id)
REFERENCES public."inboundInvoices" (inbound_id)
ON UPDATE CASCADE
ON DELETE CASCADE;