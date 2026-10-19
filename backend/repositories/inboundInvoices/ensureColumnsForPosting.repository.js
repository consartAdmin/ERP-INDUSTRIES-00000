// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ ensureColumnsForPosting.repository.js — CONSART ERP | Notas de Entrada  ║
// ║ Garante colunas e índices usados na postagem da NF-e de entrada          ║
// ╚══════════════════════════════════════════════════════════════════════════╝

'use strict';

import { queueErrorEmail } from '../../errorEmailReporter.js';

import {
  TB_INVOICES,
  TB_III,
  TB_II_INSTALLMENTS,
  q,
} from './_shared.js';

function reportInboundError(...args) {
  console.error(...args);
  const caught = args.find((value) => value instanceof Error);
  const label = typeof args[0] === 'string'
    ? args[0]
    : 'Erro na API de notas de entrada';

  queueErrorEmail('INBOUND_API_ERROR', {
    module: 'services/apis/inboundInvoices/ensureColumnsForPosting.repository.js',
    message: caught?.message || label,
    context: label,
    err: caught
      ? {
        name: caught.name,
        message: caught.message,
        code: caught.code,
        stack: caught.stack,
      }
      : undefined,
    details: args,
  });
}

export async function ensureColumnsForPosting() {
  try {
    await q(`ALTER TABLE ${TB_INVOICES} ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'DRAFT'`);
    await q(`ALTER TABLE ${TB_INVOICES} ADD COLUMN IF NOT EXISTS stock_applied BOOLEAN DEFAULT FALSE`);
    await q(`ALTER TABLE ${TB_INVOICES} ADD COLUMN IF NOT EXISTS stock_applied_at TIMESTAMPTZ`);

    await q(`ALTER TABLE ${TB_III} ADD COLUMN IF NOT EXISTS nf_product_code VARCHAR(60)`);
    await q(`ALTER TABLE ${TB_III} ADD COLUMN IF NOT EXISTS product_code VARCHAR(80)`);
    await q(`ALTER TABLE ${TB_III} ADD COLUMN IF NOT EXISTS product_id BIGINT`);
    await q(`ALTER TABLE ${TB_III} ADD COLUMN IF NOT EXISTS product_grade_id INTEGER`);
    await q(`ALTER TABLE ${TB_III} ADD COLUMN IF NOT EXISTS lot_id BIGINT`);

    await q(`CREATE INDEX IF NOT EXISTS inbound_invoices_access_key_idx ON ${TB_INVOICES} (access_key)`);
    await q(`CREATE INDEX IF NOT EXISTS idx_inbound_items_inbound_id ON ${TB_III} (inbound_id)`);
    await q(`CREATE INDEX IF NOT EXISTS inbound_items_product_id_idx ON ${TB_III} (product_id)`);
    await q(`CREATE INDEX IF NOT EXISTS inbound_items_product_grade_id_idx ON ${TB_III} (product_grade_id)`);
    await q(`CREATE INDEX IF NOT EXISTS inbound_items_lot_id_idx ON ${TB_III} (lot_id)`);
    await q(`CREATE INDEX IF NOT EXISTS idx_inbound_installments_inbound_id ON ${TB_II_INSTALLMENTS} (inbound_id)`);

    await q(`ALTER TABLE ${TB_III} ADD COLUMN IF NOT EXISTS icms_cst VARCHAR(10)`);
    await q(`ALTER TABLE ${TB_III} ADD COLUMN IF NOT EXISTS icms_base NUMERIC(15,2)`);
    await q(`ALTER TABLE ${TB_III} ADD COLUMN IF NOT EXISTS icms_rate NUMERIC(9,4)`);
    await q(`ALTER TABLE ${TB_III} ADD COLUMN IF NOT EXISTS icms_st_base NUMERIC(15,2)`);
    await q(`ALTER TABLE ${TB_III} ADD COLUMN IF NOT EXISTS icms_st_rate NUMERIC(9,4)`);
    await q(`ALTER TABLE ${TB_III} ADD COLUMN IF NOT EXISTS icms_st_value NUMERIC(15,2)`);
    await q(`ALTER TABLE ${TB_III} ADD COLUMN IF NOT EXISTS nfe_key VARCHAR(44)`);
    await q(`ALTER TABLE ${TB_III} ADD COLUMN IF NOT EXISTS nfe_item_seq INTEGER`);
  } catch (err) {
    reportInboundError('[inboundInvoicesApi] ensureColumnsForPosting:', err.message);
  }
}

export default ensureColumnsForPosting;
