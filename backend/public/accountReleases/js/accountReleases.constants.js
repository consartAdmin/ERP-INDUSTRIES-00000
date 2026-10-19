// ╔══════════════════════════════════════════════════════════════════════╗
// ║ accountReleases.constants.js                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

export const CATEGORY_LABELS = {
  inbound_documents: 'Inbound Documents',
  outbound_documents: 'Outbound Documents',
  accounting_documents: 'Accounting Documents',
  sped: 'SPED',
  payroll: 'Payroll',
  taxes: 'Taxes',
  contracts: 'Contracts',
  other: 'Other',
};

export const ATTACHMENT_TYPE_LABELS = {
  xml: 'XML',
  pdf: 'PDF',
  receipt: 'Receipt',
  tax_guide: 'Tax Guide',
  spreadsheet: 'Spreadsheet',
  statement: 'Statement',
  contract: 'Contract',
  sped_file: 'SPED File',
  other: 'Other',
};

export const DEFAULT_CATEGORY = 'accounting_documents';

export const DEFAULT_PAGE_LIMIT = 20;