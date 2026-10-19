// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgets.sql.js — Fragmentos SQL reutilizados                         ║
// ║ AGG_FIELDS / BUDGET_SELECT / BUDGET_SORT_COLUMNS                     ║
// ╚══════════════════════════════════════════════════════════════════════╝

import budgetsSchema from './budgets.catalog.js';
import {
  ALIAS_B,
  TB_BUDGETS_SHIPPING,
} from './budgets.constants.js';

// ----------------------------------------------------------------------
// SQL fragments
// ----------------------------------------------------------------------
export const AGG_FIELDS = `
    COUNT(i.budget_item_id) AS items_count
  `;

export const BUDGET_SELECT = `
    ${budgetsSchema.selectColumns
    .map((column) => `${ALIAS_B}."${column}"`)
    .join(',\n    ')},
    (
      SELECT ot.code
      FROM public."nfeOperationTypes" ot
      WHERE ot.operation_type_id = b.operation_type_id
      LIMIT 1
    ) AS operation_code,
    (
      SELECT ot.name
      FROM public."nfeOperationTypes" ot
      WHERE ot.operation_type_id = b.operation_type_id
      LIMIT 1
    ) AS operation_name,
    (
      SELECT ot.nature_operation
      FROM public."nfeOperationTypes" ot
      WHERE ot.operation_type_id = b.operation_type_id
      LIMIT 1
    ) AS nature_operation,
    (
      SELECT ot.cfop_internal
      FROM public."nfeOperationTypes" ot
      WHERE ot.operation_type_id = b.operation_type_id
      LIMIT 1
    ) AS operation_cfop_internal,
    (
      SELECT ot.cfop_interstate
      FROM public."nfeOperationTypes" ot
      WHERE ot.operation_type_id = b.operation_type_id
      LIMIT 1
    ) AS operation_cfop_interstate,
    COALESCE((
      SELECT bs.freight_value
      FROM ${TB_BUDGETS_SHIPPING} bs
      WHERE bs.budget_shipping_id = b.budget_shipping_id
      LIMIT 1
    ), 0) AS freight_value
  `;

export const BUDGET_SORT_COLUMNS = Object.freeze({
  budget_id:
    'b.budget_id',

  issue_date:
    'b.issue_date',

  customer_name:
    `LOWER(COALESCE(b.customer_name, ''))`,

  notes:
    `LOWER(
      COALESCE(
        b.notes,
        ''
      )
    )`,

  customer_tax_id:
    `COALESCE(b.customer_tax_id, '')`,

  items_count:
    'COUNT(i.budget_item_id)',

  total_amount:
    'b.total_amount',

  status:
    `LOWER(
      COALESCE(
        b.status,
        ''
      )
    )`,

  seller_id:
    'b.seller_id',
});
