// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgets.mappers.js — Linha do banco → objeto                         ║
// ║ rowToBudget / rowToItem / rowToShipping                              ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  isFiniteNum,
  boolFromAny,
  coalesceName,
  coalesceTaxId,
} from './budgets.utils.js';

// ----------------------------------------------------------------------
// Row mappers
// ----------------------------------------------------------------------
export function rowToBudget(row) {
  if (!row) return null;

  return {
    budget_id: row.budget_id,
    issue_date: row.issue_date,
    status: row.status,
    operation_type_id: row.operation_type_id != null
      ? Number(row.operation_type_id)
      : null,
    operation_code: row.operation_code ?? null,
    operation_name: row.operation_name ?? null,
    nature_operation: row.nature_operation ?? null,
    operation_cfop_internal: row.operation_cfop_internal ?? null,
    operation_cfop_interstate: row.operation_cfop_interstate ?? null,

    customer_id: row.customer_id,
    customer_name: coalesceName(row),
    customer_tax_id: coalesceTaxId(row),
    customer_email: row.customer_email ?? null,
    customer_phone: row.customer_phone ?? null,
    // Compatibility aliases for the current frontend.
    email: row.customer_email ?? null,
    phone: row.customer_phone ?? null,

    notes: row.notes ?? null,
    freight_value: Number(row.freight_value || 0),
    budget_shipping_id: row.budget_shipping_id ?? null,

    payment_form_id: row.payment_form_id ?? null,
    payment_term_id: row.payment_term_id ?? null,

    seller_id: row.seller_id ?? null,
    price_id: row.price_id != null ? Number(row.price_id) : null,

    subtotal: Number(row.subtotal || 0),
    items_discount_total: Number(row.items_discount_total || 0),
    total_discount: Number(row.total_discount || 0),

    global_discount_type: row.global_discount_type || 'value',
    global_discount_value: Number(row.global_discount_value || 0),
    global_discount_amount: Number(row.global_discount_amount || 0),

    created_at: row.created_at,
    updated_at: row.updated_at,

    items_count: Number(row.items_count || 0),
    total_amount: isFiniteNum(row.total_amount) ? Number(row.total_amount) : 0,
  };
}

export function rowToItem(row) {
  if (!row) return null;

  return {
    budget_item_id: row.budget_item_id,
    budget_id: row.budget_id,

    product_code: row.product_code,
    sku: row.product_code,
    barcode_id: row.barcode_id ?? null,

    manufacturer_ref:
      row.manufacturer_ref ??
      null,

    description: row.description,
    grade_id: row.grade_id ?? null,
    grade: row.grade ?? null,
    unit_code: row.unit_code,
    unit: row.unit_code,
    conversion_factor: Number(row.conversion_factor || 1),
    quantity: Number(row.quantity || 0),
    // Weight of the commercial package selected for this budget item.
    unit_weight_kg: Number(row.weight_kg || 0),
    weight_kg: Number(row.weight_kg || 0),
    gross_weight_kg: Number(row.quantity || 0) * Number(row.weight_kg || 0),
    unit_price: Number(row.unit_price || 0),
    discount_value: Number(row.discount_value || 0),

    price_id: row.price_id ?? null,
    commission_id: row.commission_id ?? null,

    products_fiscal_id: row.products_fiscal_id ?? null,
    ncm: row.ncm ?? row.ncm_code ?? null,

    lot_id: row.lot_id ?? null,
    lot_code: row.lot_code ?? null,
    lot_expiration: row.lot_expiration ?? null,

    override_stock: boolFromAny(row.override_stock),
    override_token: row.override_token ?? null,
    override_approved_at: row.override_approved_at ?? null,
    override_approved_by: row.override_approved_by ?? null,
    override_reason: row.override_reason ?? null,
    override_qty: row.override_qty != null ? Number(row.override_qty) : null,
    override_lot_id: row.override_lot_id ?? null,
  };
}

export function rowToShipping(row) {
  if (!row) return null;

  return {
    budget_shipping_id: row.budget_shipping_id,
    freight_value: Number(row.freight_value || 0),
    freight_mode: Number(row.freight_mode ?? 9),

    carrier_name: row.carrier_name ?? null,
    carrier_cnpj_cpf: row.carrier_cnpj_cpf ?? null,
    carrier_ie: row.carrier_ie ?? null,

    carrier_address: row.carrier_address ?? null,
    carrier_number: row.carrier_number ?? null,
    carrier_complement: row.carrier_complement ?? null,
    carrier_district: row.carrier_district ?? null,
    carrier_city: row.carrier_city ?? null,
    carrier_state: row.carrier_state ?? null,
    carrier_zipcode: row.carrier_zipcode ?? null,

    vehicle_plate: row.vehicle_plate ?? null,
    vehicle_state: row.vehicle_state ?? null,
    vehicle_rntc: row.vehicle_rntc ?? null,

    volumes: Number(row.volumes || 0),
    volume_species: row.volume_species ?? null,
    volume_brand: row.volume_brand ?? null,
    volume_numbering: row.volume_numbering ?? null,

    gross_weight: Number(row.gross_weight || 0),
    net_weight: Number(row.net_weight || 0),

    notes: row.notes ?? null,
    is_active: boolFromAny(row.is_active),

    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
