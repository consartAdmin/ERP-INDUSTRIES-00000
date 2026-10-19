// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ensureTable.repository.js — CONSART ERP | Notas Fiscais Emitidas     ║
// ║ Shim de compatibilidade: o schema é gerido fora da API em runtime    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { TB_INVOICES } from './_shared.js';

export async function ensureTable() {
  // Compatibility shim.
  // The invoicesIssued schema is managed outside the runtime API
  // (migrations + catalog_schema.invoicesIssued.js).
  return {
    ok: true,
    table: TB_INVOICES,
    managedBy: 'catalog_schema.invoicesIssued.js',
  };
}

export default ensureTable;
