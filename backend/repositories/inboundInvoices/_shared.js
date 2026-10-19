// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ _shared.js — CONSART ERP | Notas de Entrada (infra interna)             ║
// ║ Pool, tabelas, helpers e mapeadores usados pelos repositories do módulo  ║
// ╚══════════════════════════════════════════════════════════════════════════╝

'use strict';

import pool from './../../config/db.js';

export { pool };

// ==========================================================================
// Tabelas
// ==========================================================================
export const TB_INVOICES = 'public."inboundInvoices"';
export const TB_III = 'public."inboundInvoiceItems"';
export const TB_II_INSTALLMENTS = 'public."inboundInvoiceInstallments"';
export const TB_PRODUCTS_LM_REF = 'public."productsLmRef"';

// ==========================================================================
// Helpers
// ==========================================================================
export async function q(text, params = []) {
  return pool.query(text, params);
}

export function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// ==========================================================================
// Mapeadores de resposta
//
// Aliases temporários mantêm compatibilidade com a UI atual.
// As queries continuam usando apenas os nomes semânticos das colunas.
// ==========================================================================
export function invoiceResponse(row) {
  return row ? { ...row, id: row.inbound_id } : null;
}

export function itemResponse(row) {
  return row
    ? { ...row, id: row.inbound_item_id, invoice_id: row.inbound_id }
    : null;
}

export function installmentResponse(row) {
  return row
    ? { ...row, id: row.inbound_installment_id, invoice_id: row.inbound_id }
    : null;
}
