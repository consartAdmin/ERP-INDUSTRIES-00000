// ╔══════════════════════════════════════════════════════════════════╗
// ║ supplierReturnsSchema.repository.js — ensureTables               ║
// ║ DDL das tabelas de devolução ao fornecedor                       ║
// ╚══════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';

export async function ensureTables() {
    await pool.query(`
    CREATE TABLE IF NOT EXISTS public."supplierReturnNfe" (
      return_id SERIAL PRIMARY KEY,
      supplier_id INTEGER NOT NULL,
      supplier_name TEXT,
      supplier_document VARCHAR(20),
      supplier_ie VARCHAR(30),
      supplier_city TEXT,
      supplier_uf VARCHAR(2),

      original_nfe_key VARCHAR(44) NOT NULL,
      original_document_number VARCHAR(20),
      original_series VARCHAR(10),
      original_issue_date TIMESTAMP NULL,

      return_reason TEXT,
      status VARCHAR(30) DEFAULT 'DRAFT',
      nfe_id INTEGER,
      total_value NUMERIC(15,2) DEFAULT 0,

      plugnotas_id TEXT,
      plugnotas_status TEXT,
      plugnotas_response JSONB,
      emitted_at TIMESTAMP NULL,
      authorized_at TIMESTAMP NULL,
      rejected_reason TEXT,

      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    );

    ALTER TABLE public."supplierReturnNfe"
      ADD COLUMN IF NOT EXISTS supplier_name TEXT,
      ADD COLUMN IF NOT EXISTS supplier_document VARCHAR(20),
      ADD COLUMN IF NOT EXISTS supplier_ie VARCHAR(30),
      ADD COLUMN IF NOT EXISTS supplier_city TEXT,
      ADD COLUMN IF NOT EXISTS supplier_uf VARCHAR(2),
      ADD COLUMN IF NOT EXISTS original_issue_date TIMESTAMP NULL,

      ADD COLUMN IF NOT EXISTS original_nat_op TEXT,
      ADD COLUMN IF NOT EXISTS original_model VARCHAR(5),
      ADD COLUMN IF NOT EXISTS original_tp_nf VARCHAR(5),
      ADD COLUMN IF NOT EXISTS original_fin_nfe VARCHAR(5),

      ADD COLUMN IF NOT EXISTS supplier_json JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS destination_json JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS totals_json JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS transport_json JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS billing_json JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS payments_json JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS additional_info_json JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS references_json JSONB DEFAULT '[]'::jsonb,

      ADD COLUMN IF NOT EXISTS plugnotas_id TEXT,
      ADD COLUMN IF NOT EXISTS plugnotas_status TEXT,
      ADD COLUMN IF NOT EXISTS plugnotas_response JSONB,
      ADD COLUMN IF NOT EXISTS emitted_at TIMESTAMP NULL,
      ADD COLUMN IF NOT EXISTS authorized_at TIMESTAMP NULL,
      ADD COLUMN IF NOT EXISTS rejected_reason TEXT,
      ADD COLUMN IF NOT EXISTS nfe_number INTEGER,
      ADD COLUMN IF NOT EXISTS nfe_status_id INTEGER;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_supplier_return_nfe_status'
      ) THEN
        ALTER TABLE public."supplierReturnNfe"
          ADD CONSTRAINT fk_supplier_return_nfe_status
          FOREIGN KEY (nfe_status_id) REFERENCES public."nfeStatusMap"(nfe_status_id)
          ON UPDATE CASCADE ON DELETE RESTRICT;
      END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS idx_supplier_return_nfe_status
      ON public."supplierReturnNfe" (nfe_status_id);

    UPDATE public."supplierReturnNfe" sr
       SET nfe_status_id = nsm.nfe_status_id
      FROM public."nfeStatusMap" nsm
     WHERE sr.nfe_status_id IS NULL
       AND nsm.code = CASE UPPER(COALESCE(sr.status, 'DRAFT'))
             WHEN 'PROCESSING' THEN 'PROCESSANDO'
             WHEN 'TRANSMITTED' THEN 'PROCESSANDO'
             WHEN 'AUTHORIZED' THEN 'AUTORIZADO'
             WHEN 'REJECTED' THEN 'REJEITADO'
             WHEN 'CANCELLED' THEN 'CANCELADO'
             ELSE 'PENDENTE'
           END;

    CREATE TABLE IF NOT EXISTS public."supplierReturnNfeItems" (
      item_id SERIAL PRIMARY KEY,
      return_id INTEGER NOT NULL REFERENCES public."supplierReturnNfe"(return_id) ON DELETE CASCADE,
      source_import_item_id INTEGER,
      xml_item_no INTEGER,
      product_id INTEGER NOT NULL DEFAULT 0,
      product_code VARCHAR(50),
      description TEXT,
      quantity NUMERIC(15,4) NOT NULL,
      unit VARCHAR(10),
      unit_value NUMERIC(15,4),
      total_value NUMERIC(15,2),
      cfop VARCHAR(4),
      ncm VARCHAR(8),
      cest VARCHAR(10),
      cst_icms VARCHAR(3),
      cst_pis VARCHAR(2),
      cst_cofins VARCHAR(2)
    );

    ALTER TABLE public."supplierReturnNfeItems"
      ADD COLUMN IF NOT EXISTS source_import_item_id INTEGER,
      ADD COLUMN IF NOT EXISTS xml_item_no INTEGER,
      ADD COLUMN IF NOT EXISTS xml_snapshot JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS taxes_json JSONB DEFAULT '{}'::jsonb;

    CREATE TABLE IF NOT EXISTS public."supplierReturnNfeImportedItems" (
      import_item_id SERIAL PRIMARY KEY,
      original_nfe_key VARCHAR(44) NOT NULL,
      xml_item_no INTEGER,
      product_id INTEGER,
      product_code VARCHAR(50),
      xml_product_code VARCHAR(80),
      barcode VARCHAR(50),
      description TEXT,
      quantity_original NUMERIC(15,4),
      quantity_return NUMERIC(15,4),
      unit VARCHAR(10),
      unit_value NUMERIC(15,4),
      total_value_original NUMERIC(15,2),
      total_value_return NUMERIC(15,2),
      cfop_inbound VARCHAR(4),
      cfop VARCHAR(4),
      ncm VARCHAR(8),
      cest VARCHAR(10),
      cst_icms VARCHAR(3),
      cst_pis VARCHAR(2),
      cst_cofins VARCHAR(2),
      product_found BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT now()
    );

    ALTER TABLE public."supplierReturnNfeImportedItems"
      ADD COLUMN IF NOT EXISTS barcode_trib VARCHAR(50),
      ADD COLUMN IF NOT EXISTS unit_trib VARCHAR(10),
      ADD COLUMN IF NOT EXISTS quantity_trib NUMERIC(15,4),
      ADD COLUMN IF NOT EXISTS unit_value_trib NUMERIC(15,6),
      ADD COLUMN IF NOT EXISTS discount_value NUMERIC(15,2),
      ADD COLUMN IF NOT EXISTS freight_value NUMERIC(15,2),
      ADD COLUMN IF NOT EXISTS insurance_value NUMERIC(15,2),
      ADD COLUMN IF NOT EXISTS other_value NUMERIC(15,2),
      ADD COLUMN IF NOT EXISTS extipi VARCHAR(20),
      ADD COLUMN IF NOT EXISTS cbenef VARCHAR(20),
      ADD COLUMN IF NOT EXISTS xped VARCHAR(60),
      ADD COLUMN IF NOT EXISTS nitemped VARCHAR(20),
      ADD COLUMN IF NOT EXISTS xml_snapshot JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS taxes_json JSONB DEFAULT '{}'::jsonb;

    CREATE INDEX IF NOT EXISTS idx_supplier_return_status
      ON public."supplierReturnNfe" (status);

    CREATE INDEX IF NOT EXISTS idx_supplier_return_supplier
      ON public."supplierReturnNfe" (supplier_id);

    CREATE INDEX IF NOT EXISTS idx_supplier_return_original_key
      ON public."supplierReturnNfe" (original_nfe_key);

    CREATE INDEX IF NOT EXISTS idx_supplier_return_import_key
      ON public."supplierReturnNfeImportedItems" (original_nfe_key);
  `);
}
