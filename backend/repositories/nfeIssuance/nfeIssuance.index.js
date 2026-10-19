// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeIssuance.index.js — emissão direta de NF-e (orçamentos e pedidos) ║
// ║ Mantém a mesma API pública do antigo nfeIssuanceApi.js               ║
// ╚══════════════════════════════════════════════════════════════════════╝

// Adapter for DANFE previews and direct NF-e issuance from budgets.
// Budget items are enriched with the same fiscal V2 joins used by Orders.
// CST 60 items get their ICMS-ST origin from inboundInvoiceItems according to
// PRODUCT_STOCK_MODE: STOCK_SIMPLE -> product_code; STOCK_WITH_LOT -> lot_id + product_code.
// Resolution order for the retained ICMS-ST:
//   1) inboundInvoiceItems (the real supplier NF-e, always preferred);
//   2) productsFiscalOrigins (stored rule-based origin, marked PRODUCT_FISCAL_ORIGIN);
//   3) LOTE-INICIAL legacy fallback using the live productFiscalCostRules
//      calculation, explicitly marked as PRODUCT_FISCAL_RULE.

import { getBudgetIssuedData } from './nfeIssuanceFiscalContext.repository.js';
import { getBudgetNfePreparedData } from './nfeIssuanceItems.repository.js';
import { issueBudgetNfe } from './nfeIssuanceIssue.repository.js';
import { reconcileBudgetNfe } from './nfeIssuanceReconcile.repository.js';
import { getBudgetNfeXml, getBudgetNfeDanfe } from './nfeIssuanceDocuments.repository.js';
import { issueOrderNfe, reconcileOrderNfe } from './nfeIssuanceOrder.repository.js';

export {
  getBudgetIssuedData,
  getBudgetNfePreparedData,
  issueBudgetNfe,
  reconcileBudgetNfe,
  getBudgetNfeXml,
  getBudgetNfeDanfe,
  issueOrderNfe,
  reconcileOrderNfe,
};

export default {
  getBudgetIssuedData,
  getBudgetNfePreparedData,
  issueBudgetNfe,
  reconcileBudgetNfe,
  getBudgetNfeXml,
  getBudgetNfeDanfe,
  issueOrderNfe,
  reconcileOrderNfe,
};
