// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgets.sanitizers.js — Normalização de header / item                ║
// ║ normalizeHeaderIn / normalizeItemIn / validateItemBarcode            ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { TB_PRODUCTS_BARCODE } from './budgets.constants.js';
import {
  isFiniteNum,
  boolFromAny,
  safeString,
  pickFrom,
  normalizeMoney,
} from './budgets.utils.js';

// ----------------------------------------------------------------------
// Normalização de header / item
// ----------------------------------------------------------------------
export function normalizeHeaderIn(h) {
  const mapIn = {
    issue_date: ['issue_date', 'data', 'date', 'issueDate'],
    status: ['status'],
    operation_type_id: ['operation_type_id', 'operationTypeId'],
    customer_id: ['customer_id', 'cliente_id', 'customerId'],
    customer_name: ['customer_name', 'nome_razao_social', 'razao_social', 'name'],
    customer_tax_id: ['customer_tax_id', 'cnpj_cpf', 'cpf_cnpj', 'taxId'],
    customer_email: ['customer_email', 'email'],
    customer_phone: ['customer_phone', 'phone', 'telefone'],
    budget_shipping_id: ['budget_shipping_id', 'budgetShippingId'],
    notes: ['notes', 'observacao', 'obs'],
    freight_value: ['freight_value', 'frete', 'freightValue'],
    payment_form_id: ['payment_form_id', 'forma_pagamento_id', 'paymentFormId'],
    payment_term_id: ['payment_term_id', 'prazo_pagamento_id', 'paymentTermId'],
    seller_id: ['seller_id', 'vendedor_id', 'sellerId', 'vendedorId'],
    price_id: ['price_id', 'priceId', 'price_table_id', 'tabela_preco_id'],

    subtotal: ['subtotal'],
    items_discount_total: ['items_discount_total', 'discount_items_total', 'itens_discount_total'],
    total_discount: ['total_discount'],
    total_amount: ['total_amount', 'total', 'valor_total'],

    global_discount_type: ['global_discount_type', 'discount_type', 'globalDiscountType'],
    global_discount_value: ['global_discount_value', 'discount_value_global', 'globalDiscountValue'],
    global_discount_amount: ['global_discount_amount', 'discount_amount_global', 'globalDiscountAmount'],
  };

  const out = {
    issue_date: pickFrom(h, mapIn.issue_date) ?? new Date().toISOString().slice(0, 10),
    status: pickFrom(h, mapIn.status) ?? 'ABERTO',
    operation_type_id: (() => {
      const value = Number(pickFrom(h, mapIn.operation_type_id));
      return Number.isSafeInteger(value) && value > 0 ? value : null;
    })(),

    customer_id: pickFrom(h, mapIn.customer_id) ?? null,
    customer_name: pickFrom(h, mapIn.customer_name) ?? null,
    customer_tax_id: pickFrom(h, mapIn.customer_tax_id) ?? null,

    customer_email: pickFrom(h, mapIn.customer_email) ?? null,
    customer_phone: pickFrom(h, mapIn.customer_phone) ?? null,
    budget_shipping_id: (() => {
      const value = Number(pickFrom(h, mapIn.budget_shipping_id));
      return Number.isSafeInteger(value) && value > 0 ? value : null;
    })(),

    notes: pickFrom(h, mapIn.notes) ?? null,
    freight_value: normalizeMoney(pickFrom(h, mapIn.freight_value), 0),

    payment_form_id: pickFrom(h, mapIn.payment_form_id) ?? null,
    payment_term_id: pickFrom(h, mapIn.payment_term_id) ?? null,

    seller_id: pickFrom(h, mapIn.seller_id) ?? null,
    price_id: (() => {
      const value = Number(pickFrom(h, mapIn.price_id));
      return Number.isSafeInteger(value) && value > 0 ? value : null;
    })(),

    subtotal: normalizeMoney(pickFrom(h, mapIn.subtotal), 0),
    items_discount_total: normalizeMoney(pickFrom(h, mapIn.items_discount_total), 0),
    total_discount: normalizeMoney(pickFrom(h, mapIn.total_discount), 0),
    total_amount: normalizeMoney(pickFrom(h, mapIn.total_amount), 0),

    global_discount_type: safeString(pickFrom(h, mapIn.global_discount_type) || 'value', 20) || 'value',
    global_discount_value: normalizeMoney(pickFrom(h, mapIn.global_discount_value), 0),
    global_discount_amount: normalizeMoney(pickFrom(h, mapIn.global_discount_amount), 0),
  };

  if (!['value', 'percent'].includes(out.global_discount_type)) {
    out.global_discount_type = 'value';
  }

  if (out.seller_id != null) {
    const s = String(out.seller_id).trim();
    out.seller_id = s || null;
  }

  if (!out.customer_name || !out.customer_tax_id) {
    throw new Error('Required: customer_name AND customer_tax_id');
  }

  if (!out.operation_type_id) {
    throw new Error('Required: operation_type_id');
  }

  return out;
}

export function normalizeItemIn(it) {
  const mapIn = {
    product_code: ['product_code', 'productCode', 'sku', 'codigo'],
    barcode_id: ['barcode_id', 'barcodeId'],

    manufacturer_ref: [
      'manufacturer_ref',
      'manufacturerRef',
      'ref_fab',
      'refFab',
      'referencia_fabricante',
    ],

    description: ['description', 'descricao', 'desc'],
    grade_id: ['grade_id', 'gradeId'],
    product_grade_id: ['product_grade_id', 'produto_grade_id', 'productGradeId'],
    unit_code: ['unit_code', 'unitCode', 'unit', 'un', 'unidade'],
    conversion_factor: ['conversion_factor', 'conversionFactor', 'fator'],
    quantity: ['quantity', 'qtd', 'quantidade'],
    unit_price: ['unit_price', 'unitPrice', 'preco', 'valor'],
    discount_value: ['discount_value', 'discountValue', 'desconto', 'discount'],
    price_id: ['price_id', 'priceId', 'tabela_preco_id', 'price_table_id'],
    commission_id: ['commission_id', 'commissionId'],

    lot_id: ['lot_id', 'lotId', 'lote_id', 'loteId'],

    override_stock: ['override_stock', 'overrideStock'],
    override_token: ['override_token', 'overrideToken'],

    override_approved_at: ['override_approved_at', 'overrideApprovedAt'],
    override_approved_by: ['override_approved_by', 'overrideApprovedBy'],
    override_reason: ['override_reason', 'overrideReason'],
    override_qty: ['override_qty', 'overrideQty'],
    override_lot_id: ['override_lot_id', 'overrideLotId'],
  };

  const out = {
    product_code: safeString(pickFrom(it, mapIn.product_code), 80),
    barcode_id: pickFrom(it, mapIn.barcode_id) ?? null,

    manufacturer_ref:
      safeString(
        pickFrom(it, mapIn.manufacturer_ref),
        100
      ) || null,

    description: safeString(pickFrom(it, mapIn.description), 1000),

    grade_id: pickFrom(it, mapIn.grade_id) ?? null,

    product_grade_id:
      pickFrom(it, mapIn.product_grade_id) ?? null,

    unit_code: safeString(pickFrom(it, mapIn.unit_code) ?? 'UN', 50) || 'UN',
    conversion_factor: isFiniteNum(pickFrom(it, mapIn.conversion_factor))
      ? Number(pickFrom(it, mapIn.conversion_factor))
      : 1,

    quantity: isFiniteNum(pickFrom(it, mapIn.quantity))
      ? Number(pickFrom(it, mapIn.quantity))
      : 0,

    unit_price: isFiniteNum(pickFrom(it, mapIn.unit_price)) ? Number(pickFrom(it, mapIn.unit_price)) : 0,
    discount_value: isFiniteNum(pickFrom(it, mapIn.discount_value)) ? Number(pickFrom(it, mapIn.discount_value)) : 0,

    price_id: pickFrom(it, mapIn.price_id) ?? null,
    commission_id: pickFrom(it, mapIn.commission_id) ?? null,

    lot_id: pickFrom(it, mapIn.lot_id) ?? null,

    override_stock: boolFromAny(pickFrom(it, mapIn.override_stock)),
    override_token: safeString(pickFrom(it, mapIn.override_token), 4000) || null,

    override_approved_at: pickFrom(it, mapIn.override_approved_at) ?? null,
    override_approved_by: pickFrom(it, mapIn.override_approved_by) ?? null,
    override_reason: safeString(pickFrom(it, mapIn.override_reason), 2000) || null,
    override_qty: isFiniteNum(pickFrom(it, mapIn.override_qty)) ? Number(pickFrom(it, mapIn.override_qty)) : null,
    override_lot_id: pickFrom(it, mapIn.override_lot_id) ?? null,
  };

  if (!out.product_code || !out.description) {
    throw new Error('Required item fields: product_code, description');
  }

  if (out.barcode_id != null && String(out.barcode_id).trim() !== '') {
    const n = Number(out.barcode_id);
    out.barcode_id = Number.isSafeInteger(n) && n > 0 ? n : null;
  } else {
    out.barcode_id = null;
  }

  if (!(out.conversion_factor > 0)) {
    out.conversion_factor = 1;
  }

  if (out.price_id != null && String(out.price_id).trim() !== '') {
    const n = Number(out.price_id);
    out.price_id = Number.isFinite(n) ? n : null;
  } else {
    out.price_id = null;
  }

  if (out.commission_id != null && String(out.commission_id).trim() !== '') {
    const n = Number(out.commission_id);
    out.commission_id = Number.isFinite(n) ? n : null;
  } else {
    out.commission_id = null;
  }

  if (out.grade_id != null && String(out.grade_id).trim() !== '') {
    const n = Number(out.grade_id);
    out.grade_id = Number.isFinite(n) ? n : null;
  } else {
    out.grade_id = null;
  }

  if (out.product_grade_id != null && String(out.product_grade_id).trim() !== '') {
    const n = Number(out.product_grade_id);
    out.product_grade_id = Number.isFinite(n) ? n : null;
  } else {
    out.product_grade_id = null;
  }

  if (out.lot_id != null && String(out.lot_id).trim() !== '') {
    const n = Number(out.lot_id);
    out.lot_id = Number.isFinite(n) && n > 0 ? n : null;
  } else {
    out.lot_id = null;
  }

  if (out.override_qty != null && String(out.override_qty).trim?.() !== '') {
    const n = Number(out.override_qty);
    out.override_qty = Number.isFinite(n) && n >= 0 ? n : null;
  } else if (!Number.isFinite(Number(out.override_qty))) {
    out.override_qty = null;
  }

  if (out.override_lot_id != null && String(out.override_lot_id).trim() !== '') {
    const n = Number(out.override_lot_id);
    out.override_lot_id = Number.isFinite(n) && n > 0 ? n : null;
  } else {
    out.override_lot_id = null;
  }

  if (out.override_approved_by != null) {
    const s = String(out.override_approved_by).trim();
    out.override_approved_by = s || null;
  }

  return out;
}

export async function validateItemBarcode(client, item) {
  if (!item?.barcode_id) return;

  const result = await client.query(
    `
      SELECT barcode_id
      FROM ${TB_PRODUCTS_BARCODE}
      WHERE barcode_id = $1
        AND product_code = $2
      LIMIT 1
    `,
    [item.barcode_id, item.product_code],
  );

  if (!result.rowCount) {
    const error = new Error(
      `O código de barras ${item.barcode_id} não pertence ao produto ${item.product_code}.`,
    );
    error.status = 400;
    error.code = 'BUDGET_ITEM_BARCODE_PRODUCT_MISMATCH';
    throw error;
  }
}
