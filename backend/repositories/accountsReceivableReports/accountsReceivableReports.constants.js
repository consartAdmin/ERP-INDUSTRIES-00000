// ╔════════════════════════════════════════════════════════════════════╗
// ║ accountsReceivableReports.constants.js — Tabelas e ordenação       ║
// ╚════════════════════════════════════════════════════════════════════╝

export const TB_ORDERS = 'public."orders"';
export const TB_RECEIVABLE = 'public."accountsReceivable"';
export const TB_INVOICES = 'public."invoicesIssued"';
export const TB_CUSTOMERS = 'public."customers"';

export const ORDER_COLUMNS = {
  order_id: 's.order_id',
  issue_date: 's.issue_date',
  customer_name: 's.customer_name',
  total_amount: 's.sale_total',
  receivable_value: 's.receivable_value',
  received_value: 's.received_value',
  balance: 's.balance',
  due_date: 's.due_date',
  status: 's.reconciliation_status',
};
