// ╔════════════════════════════════════════════════════════════════════╗
// ║ nfeReceipts.constants.js — Tabelas, status e colunas               ║
// ╚════════════════════════════════════════════════════════════════════╝

export const TB = 'public."nfeReceipts"';
export const TB_INVOICES = 'public."invoicesIssued"';
export const TB_ORDERS = 'public.orders';
export const TB_BUDGETS = 'public.budgets';
export const TB_CUSTOMERS = 'public.customers';

export const RECEIPT_STATUSES = Object.freeze(['PENDING', 'SIGNED', 'REFUSED', 'CANCELLED']);

export const ACCESS_KEY_LENGTH = 44;

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Colunas do canhoto (r) + dados da NF-e (i) usadas em todas as consultas.
export const RECEIPT_SELECT = `
  r.*,
  i.nfe_number AS numero,
  NULL AS serie,
  i.total_amount AS total_nf,
  i.nfe_status,
  i.nfe_key,
  i.issued_at,
  i.danfe_url,
  i.xml_url
`;
