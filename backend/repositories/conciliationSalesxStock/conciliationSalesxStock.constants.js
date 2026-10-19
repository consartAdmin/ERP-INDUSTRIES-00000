// ╔════════════════════════════════════════════════════════════════════╗
// ║ conciliationSalesxStock.constants.js — Colunas de ordenação permitidas ║
// ╚════════════════════════════════════════════════════════════════════╝

export const SORT_COLUMNS_OPERATION = Object.freeze({
  sku: 'mr.sku',
  description: `COALESCE(r.description, mr.movement_description, '')`,
  movement_type: 'mr.movement_type',
  invoice_number: `CASE WHEN mr.invoice_number ~ '^[0-9]+$' THEN mr.invoice_number::bigint END`,
  movement_date: 'mr.movement_date',
  movement_quantity: 'mr.movement_quantity',
  stock_after: 'mr.stock_after',
  quantity_to_buy: `CASE WHEN mr.stock_after IS NULL THEN r.quantity_to_buy ELSE GREATEST(-mr.stock_after, 0) END`,
});

export const SORT_COLUMNS_TOTAL = Object.freeze({
  sku: 'r.sku',
  description: 'r.description',
  movement_type: `'TOTAL'::text`,
  invoice_number: 'r.invoices_count',
  movement_date: 'r.sku',
  movement_quantity: 'r.quantity_sold',
  stock_after: 'r.available_stock',
  quantity_to_buy: 'r.quantity_to_buy',
});
