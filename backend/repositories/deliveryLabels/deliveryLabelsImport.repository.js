// ╔════════════════════════════════════════════════════════════════════╗
// ║ deliveryLabelsImport.repository.js — Importação a partir de        ║
// ║ Pedido, Orçamento e Nota Fiscal emitida                            ║
// ║ (endereço sempre vem do cadastro do cliente)                       ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { CUSTOMER_ADDRESS_COLUMNS } from './deliveryLabels.sql.js';
import { addressFields } from './deliveryLabels.mappers.js';
import { createDeliveryLabel } from './deliveryLabelsCrud.repository.js';

export async function createFromOrder(orderId) {
  // orders não possui número/NF-e próprios: o nº do pedido é o order_id e a NF-e vem de invoicesIssued
  const { rows } = await pool.query(
    `
      SELECT
        o.order_id,
        COALESCE(NULLIF(o.customer_name, ''), c.legal_name, c.trade_name) AS customer_name,
        COALESCE(NULLIF(o.customer_tax_id, ''), c.tax_id) AS customer_tax_id,
        ${CUSTOMER_ADDRESS_COLUMNS},
        o.customer_phone,
        inv.invoice_id,
        inv.nfe_number,
        inv.nfe_key
      FROM public.orders o
      LEFT JOIN public.customers c
        ON c.customer_id = o.customer_id
      -- NF-e mais recente emitida para o pedido (se houver)
      LEFT JOIN LATERAL (
        SELECT i.invoice_id, i.nfe_number, i.nfe_key
        FROM public."invoicesIssued" i
        WHERE i.order_id = o.order_id
        ORDER BY i.invoice_id DESC
        LIMIT 1
      ) inv ON TRUE
      WHERE o.order_id = $1
      LIMIT 1
    `,
    [orderId]
  );

  const order = rows[0];

  if (!order) {
    throw new Error('Pedido não encontrado.');
  }

  return createDeliveryLabel({
    order_id: order.order_id,
    invoice_id: order.invoice_id,
    order_number: String(order.order_id),
    nfe_number: order.nfe_number,
    nfe_key: order.nfe_key,
    customer_name: order.customer_name,
    customer_tax_id: order.customer_tax_id,
    ...addressFields(order),
    phone: order.phone || order.customer_phone,
    volumes: 1,
  });
}

export async function createFromBudget(budgetId) {
  const { rows } = await pool.query(
    `
      SELECT
        b.budget_id,
        COALESCE(NULLIF(b.customer_name, ''), c.legal_name, c.trade_name) AS customer_name,
        COALESCE(NULLIF(b.customer_tax_id, ''), c.tax_id) AS customer_tax_id,
        ${CUSTOMER_ADDRESS_COLUMNS},
        b.customer_phone,
        inv.invoice_id,
        inv.nfe_number,
        inv.nfe_key
      FROM public.budgets b
      LEFT JOIN public.customers c
        ON c.customer_id = b.customer_id
      -- NF-e mais recente emitida para o orçamento (se houver)
      LEFT JOIN LATERAL (
        SELECT i.invoice_id, i.nfe_number, i.nfe_key
        FROM public."invoicesIssued" i
        WHERE i.budget_id = b.budget_id
        ORDER BY i.invoice_id DESC
        LIMIT 1
      ) inv ON TRUE
      WHERE b.budget_id = $1
      LIMIT 1
    `,
    [budgetId]
  );

  const budget = rows[0];

  if (!budget) {
    throw new Error('Orçamento não encontrado.');
  }

  return createDeliveryLabel({
    invoice_id: budget.invoice_id,
    order_number: `ORC ${budget.budget_id}`,
    nfe_number: budget.nfe_number,
    nfe_key: budget.nfe_key,
    customer_name: budget.customer_name,
    customer_tax_id: budget.customer_tax_id,
    ...addressFields(budget),
    phone: budget.phone || budget.customer_phone,
    notes: `Importado do orçamento #${budget.budget_id}`,
    volumes: 1,
  });
}

export async function createFromInvoice(invoiceId) {
  const { rows } = await pool.query(
    `
      SELECT
        i.invoice_id,
        i.order_id,
        i.budget_id,
        i.nfe_number,
        i.nfe_key,
        COALESCE(
          NULLIF(i.customer_name, ''), NULLIF(o.customer_name, ''),
          NULLIF(b.customer_name, ''), c.legal_name, c.trade_name
        ) AS customer_name,
        COALESCE(
          NULLIF(i.customer_tax_id, ''), NULLIF(o.customer_tax_id, ''),
          NULLIF(b.customer_tax_id, ''), c.tax_id
        ) AS customer_tax_id,
        ${CUSTOMER_ADDRESS_COLUMNS}
      FROM public."invoicesIssued" i
      LEFT JOIN public.orders o
        ON o.order_id = i.order_id
      LEFT JOIN public.budgets b
        ON b.budget_id = i.budget_id
      -- cliente: do pedido; se a nota veio de orçamento, do orçamento
      LEFT JOIN public.customers c
        ON c.customer_id = COALESCE(o.customer_id, b.customer_id)
      WHERE i.invoice_id = $1
      LIMIT 1
    `,
    [invoiceId]
  );

  const invoice = rows[0];

  if (!invoice) {
    throw new Error('Nota fiscal não encontrada.');
  }

  const orderNumber = invoice.order_id
    ? String(invoice.order_id)
    : (invoice.budget_id ? `ORC ${invoice.budget_id}` : null);

  return createDeliveryLabel({
    order_id: invoice.order_id,
    invoice_id: invoice.invoice_id,
    order_number: orderNumber,
    nfe_number: invoice.nfe_number,
    nfe_key: invoice.nfe_key,
    customer_name: invoice.customer_name,
    customer_tax_id: invoice.customer_tax_id,
    ...addressFields(invoice),
    notes: `Importado da NF-e ${invoice.nfe_number ?? `#${invoice.invoice_id}`}`,
    volumes: 1,
  });
}
