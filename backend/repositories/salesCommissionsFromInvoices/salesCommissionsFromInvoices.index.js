// ╔════════════════════════════════════════════════════════════════════╗
// ║ salesCommissionsFromInvoices.index.js — ponto de entrada           ║
// ║ Mantém a mesma API pública do antigo                               ║
// ║ salesCommissionsFromInvoicesApi.js                                 ║
// ╚════════════════════════════════════════════════════════════════════╝

export { generateSalesCommissionsFromInvoices } from './salesCommissionsFromInvoicesGenerate.repository.js';
export { recalcSalesCommissionsFromInvoices } from './salesCommissionsFromInvoicesRecalc.repository.js';
export {
  diagnosticsSalesCommissionsFromInvoices,
  listSalesCommissionsFromInvoices,
} from './salesCommissionsFromInvoicesQuery.repository.js';
export { getSalesCommissionsFromInvoicesPdfData } from './salesCommissionsFromInvoicesPdfData.repository.js';
