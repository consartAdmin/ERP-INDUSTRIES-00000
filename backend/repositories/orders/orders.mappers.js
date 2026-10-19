// ╔══════════════════════════════════════════════════════════════════════╗
// ║ orders.mappers.js — Mapeadores de pedidos                            ║
// ║ Linha -> objeto, orçamento -> registros, pagamentos                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { ORDER_STATUS } from '../../services/shared/constants/orderStatus.js';
import {
  ORDERS_PRIMARY_KEY,
  ORDER_UPDATE_COLUMNS,
  ORDER_MONEY_COLUMNS,
  ORDER_REQUIRED_COLUMNS,
  ORDER_DEFAULTS,
} from './orders.catalog.js';
import { ORDERS_ITEMS_PRIMARY_KEY, ORDER_ITEM_REQUIRED_COLUMNS, ORDER_ITEM_DEFAULTS } from './ordersItems.catalog.js';
import { ORDER_MONEY_COLUMN_SET } from './orders.constants.js';
import { applyDefaults, assertRequired } from './orders.sql.js';
import { isFiniteNum, round2, formatMoneyBR, safeText, formatDateBR, coalesceName, coalesceTaxId, parseMoney, normalizeMoney, normDiscountType, orderMoneyFields, orderItemNumericFields } from './orders.utils.js';

export function rowToOrder(row) {
  if (!row) return null;

  const orderId = Number(row[ORDERS_PRIMARY_KEY]);
  const freightValue = Number(row.freight_value || 0);
  const money = orderMoneyFields(row);

  return {
    order_id: orderId,
    // Backward-compatible alias for screens that still display "number".
    number: orderId,
    budget_id: row.budget_id,
    issue_date: row.issue_date,
    status: row.status,

    customer_id: row.customer_id,
    customer_name: row.customer_name ?? null,
    customer_tax_id: row.customer_tax_id ?? null,
    customer_email: row.customer_email ?? null,
    customer_phone: row.customer_phone ?? null,
    // Legacy aliases kept only in the API payload.
    email: row.customer_email ?? null,
    phone: row.customer_phone ?? null,

    seller_id: row.seller_id ?? null,
    price_id: row.price_id ?? null,
    operation_type_id: row.operation_type_id,
    payment_form_id: row.payment_form_id ?? null,
    payment_term_id: row.payment_term_id ?? null,
    order_shipping_id: row.order_shipping_id ?? null,

    notes: row.notes,

    ...money,
    global_discount_type: row.global_discount_type || ORDER_DEFAULTS.global_discount_type,

    freight_value: freightValue,
    freight_mode: row.freight_mode != null ? Number(row.freight_mode) : null,

    // Fiscal information now comes from invoicesIssued, not orders.
    invoice_id: row.invoice_id ?? null,
    nfe_status: row.nfe_status ?? null,
    nfe_key: row.nfe_key ?? null,
    nfe_number: row.nfe_number ?? null,
    nfe_protocol: row.nfe_protocol ?? null,
    nfe_xml_url: row.nfe_xml_url ?? null,
    nfe_danfe_url: row.nfe_danfe_url ?? null,
    nfe_environment: row.nfe_environment ?? null,
    nfe_plugnotas_id: row.nfe_provider_id ?? null,
    nfe_issue_datetime: row.nfe_issue_datetime ?? null,
    nfe_issue_date: row.nfe_issue_date ?? null,

    customer_codigo_ibge: row.customer_codigo_ibge ?? null,
    customer_uf: row.customer_uf ?? null,
    customer_city: row.customer_city ?? null,

    created_at: row.created_at,
    updated_at: row.updated_at,

    items_count: Number(row.items_count || 0),
    subtotal_amount: isFiniteNum(row.subtotal_amount)
      ? Number(row.subtotal_amount)
      : money.subtotal,
    total_discount_amount: isFiniteNum(row.total_discount_amount)
      ? Number(row.total_discount_amount)
      : money.total_discount,
    freight_amount: isFiniteNum(row.freight_amount)
      ? Number(row.freight_amount)
      : freightValue,
    total_amount_agg: isFiniteNum(row.total_amount_agg)
      ? Number(row.total_amount_agg)
      : money.total_amount,
  };
}

export function rowToItem(row) {
  if (!row) return null;

  const ncm = row.ncm ?? row.ncm_code ?? null;
  const cest = row.cest ?? row.cest_code ?? null;

  const profileName = row.fiscal_profile ?? row.profile_name ?? null;
  const className = row.fiscal_classification ?? row.classification_name ?? null;

  return {
    order_item_id: row[ORDERS_ITEMS_PRIMARY_KEY],
    order_id: row.order_id,

    product_code: row.product_code,
    // Legacy alias kept for frontend/NF-e compatibility.
    sku: row.product_code,
    barcode_id: row.barcode_id ?? null,
    description: row.description,
    manufacturer_ref: row.manufacturer_ref ?? null,
    grade_id: row.grade_id ?? null,
    grade: row.grade ?? null,

    unit_code: row.unit_code,
    unit: row.unit_code,

    // conversion_factor, quantity, unit_price, discount_value, override_qty
    ...orderItemNumericFields(row),

    price_id: row.price_id ?? null,
    commission_id: row.commission_id ?? null,
    lot_id: row.lot_id ?? null,

    override_stock: Boolean(row.override_stock ?? ORDER_ITEM_DEFAULTS.override_stock),
    override_token: row.override_token ?? null,
    override_approved_at: row.override_approved_at ?? null,
    override_approved_by: row.override_approved_by ?? null,
    override_reason: row.override_reason ?? null,
    override_lot_id: row.override_lot_id ?? null,

    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,

    products_fiscal_id: row.products_fiscal_id ?? null,
    fiscal_classification_id: row.fiscal_classification_id ?? null,
    fiscal_profile_id: row.fiscal_profile_id ?? null,
    fiscal_profile: profileName,
    tax_profile_name: profileName,
    fiscal_classification: className,
    profile_name: profileName,
    classification_name: className,

    ncm,
    ncm_code: ncm,
    ncm_description: row.ncm_description ?? null,
    cest,
    cest_code: cest,
    cest_description: row.cest_description ?? null,
    ex_tipi: row.ex_tipi ?? null,

    cfop: row.cfop_exit ?? null,
    cfop_entry: row.cfop_entry ?? null,
    cfop_exit: row.cfop_exit ?? null,
    origin_code: row.origin_code ?? null,
    origem_mercadoria: row.origin_code ?? null,

    icms_cst: row.icms_cst ?? null,
    cst_icms: row.icms_cst ?? null,
    icms_rate: Number(row.icms_rate ?? 0),
    aliquota_icms: Number(row.icms_rate ?? 0),

    pis_cst: row.pis_cst ?? null,
    pis_rate: Number(row.pis_rate ?? 0),
    pis_aliquota: Number(row.pis_rate ?? 0),
    cofins_cst: row.cofins_cst ?? null,
    cofins_rate: Number(row.cofins_rate ?? 0),
    cofins_aliquota: Number(row.cofins_rate ?? 0),
    benefit_code: row.benefit_code ?? null,

    is_cst: row.is_cst ?? null,
    is_classification: row.is_classification ?? null,
    is_rate: Number(row.is_rate ?? 0),
    is_specific_rate: Number(row.is_specific_rate ?? 0),
    is_unit: row.is_unit ?? 'UN',
    ibscbs_cst: row.ibscbs_cst ?? null,
    ibscbs_classification: row.ibscbs_classification ?? null,
    ibs_uf_rate: Number(row.ibs_uf_rate ?? 0),
    ibs_municipal_rate: Number(row.ibs_municipal_rate ?? 0),
    cbs_rate: Number(row.cbs_rate ?? 0),
    donation_indicator: row.donation_indicator ?? 1,
    tax_reform_details: row.tax_reform_details ?? {},
  };
}
// ----------------------------------------------------------------------
// Budget → registros de orders / ordersItems (validados pelo catálogo)
// ----------------------------------------------------------------------
export function budgetToOrderRecord(budgetId, h, { customerId, sellerId }) {
  const record = applyDefaults({
    budget_id: budgetId,
    issue_date: h.issue_date ?? null,
    status: ORDER_STATUS.CONVERTED,
    customer_id: customerId ?? null,
    customer_name: coalesceName(h),
    customer_tax_id: coalesceTaxId(h),
    customer_email: h.customer_email ?? null,
    customer_phone: h.customer_phone ?? null,
    seller_id: sellerId ?? null,
    price_id: h.price_id ?? null,
    operation_type_id: h.operation_type_id ?? null,
    payment_form_id: h.payment_form_id ?? null,
    payment_term_id: h.payment_term_id ?? null,
    // order_shipping_id é definido depois por syncShippingFromBudgetToOrder.
    subtotal: h.subtotal,
    items_discount_total: h.items_discount_total,
    global_discount_type: normDiscountType(h.global_discount_type),
    global_discount_value: h.global_discount_value,
    global_discount_amount: h.global_discount_amount,
    total_discount: h.total_discount,
    total_amount: h.total_amount,
    notes: h.notes ?? null,
  }, ORDER_DEFAULTS);

  for (const column of ORDER_MONEY_COLUMNS) {
    record[column] = normalizeMoney(record[column], ORDER_DEFAULTS[column] ?? 0);
  }

  assertRequired(record, ORDER_REQUIRED_COLUMNS, `Orçamento ${budgetId}`);
  return record;
}

export function budgetItemToOrderItemRecord(orderId, budgetId, it) {
  const lotId = Number(it.lot_id) > 0 ? Number(it.lot_id) : null;

  const record = applyDefaults({
    order_id: orderId,
    product_code: safeText(it.product_code ?? it.sku),
    barcode_id: it.barcode_id ?? null,
    description: safeText(it.description),
    manufacturer_ref: it.manufacturer_ref ?? null,
    grade_id: it.grade_id ?? null,
    unit_code: safeText(it.unit_code ?? it.unit, 'UN'),
    conversion_factor: Number(it.conversion_factor) || ORDER_ITEM_DEFAULTS.conversion_factor,
    quantity: it.quantity,
    unit_price: it.unit_price,
    discount_value: it.discount_value,
    price_id: it.price_id ?? null,
    commission_id: it.commission_id ?? null,
    lot_id: lotId,
    override_stock: it.override_stock != null ? Boolean(it.override_stock) : null,
    override_token: it.override_token ?? null,
    override_approved_at: it.override_approved_at ?? null,
    override_approved_by: it.override_approved_by != null ? String(it.override_approved_by) : null,
    override_reason: it.override_reason ?? null,
    override_qty: it.override_qty,
    override_lot_id: it.override_lot_id ?? null,
  }, ORDER_ITEM_DEFAULTS);

  Object.assign(record, orderItemNumericFields(record));

  assertRequired(
    record,
    ORDER_ITEM_REQUIRED_COLUMNS,
    `Item ${it.budget_item_id ?? '?'} do orçamento ${budgetId}`,
  );
  return record;
}

// Aliases legados aceitos no patch de update()
export const ORDER_UPDATE_ALIASES = Object.freeze({
  customer_email: ['email'],
  customer_phone: ['phone'],
});

export function patchToOrderUpdateRecord(patch = {}) {
  const record = {};

  for (const column of ORDER_UPDATE_COLUMNS) {
    let value = patch[column];

    if (value == null) {
      for (const alias of ORDER_UPDATE_ALIASES[column] || []) {
        if (patch[alias] != null) {
          value = patch[alias];
          break;
        }
      }
    }

    if (value == null) continue;

    if (column === 'global_discount_type') {
      value = normDiscountType(value);
    } else if (ORDER_MONEY_COLUMN_SET.has(column)) {
      value = parseMoney(value);
      if (value == null) continue;
    }

    record[column] = value;
  }

  return record;
}

export function rowToBudgetPayment(row) {
  return {
    budget_payment_id: Number(row.budget_payment_id),
    budget_id: Number(row.budget_id),

    payment_method_id: row.payment_method_id != null ? Number(row.payment_method_id) : null,
    payment_method_name: row.payment_method_name || null,
    payment_method_type: row.payment_method_type || null,

    amount: round2(row.amount),

    installments: row.installments != null ? Number(row.installments) : null,
    gap_one: row.gap_one != null ? Number(row.gap_one) : null,
    gap_two: row.gap_two != null ? Number(row.gap_two) : null,
    gap_three: row.gap_three != null ? Number(row.gap_three) : null,
    gap_four: row.gap_four != null ? Number(row.gap_four) : null,

    manual_due_date: row.manual_due_date ?? null,

    notes: row.notes ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

export function rowToBudgetPaymentInstallment(row) {
  return {
    budget_payment_installment_id: Number(row.budget_payment_installment_id),
    budget_payment_id: Number(row.budget_payment_id),
    installment_number: row.installment_number != null ? Number(row.installment_number) : null,
    due_date: row.due_date ?? null,
    amount: round2(row.amount),
  };
}

export function buildPaymentLines(payments = []) {
  return payments.map((payment) => {
    const method = safeText(payment.payment_method_name, 'FORMA NÃO INFORMADA');
    return `${method}: ${formatMoneyBR(payment.amount)}`;
  });
}

export function buildDuplicatasLines(payments = [], installments = []) {
  if (Array.isArray(installments) && installments.length) {
    return installments.map((item) => ({
      numero: String(item.installment_number ?? 1).padStart(3, '0'),
      vencimento: formatDateBR(item.due_date),
      valor: round2(item.amount),
    }));
  }

  return payments.map((payment, index) => ({
    numero: String(index + 1).padStart(3, '0'),
    vencimento: '—',
    valor: round2(payment.amount),
    descricao: safeText(payment.payment_method_name, 'FORMA NÃO INFORMADA'),
  }));
}

export function buildPaymentObservationText(payments = [], installments = []) {
  const paymentLines = buildPaymentLines(payments);

  if (!paymentLines.length) return '';

  if (installments.length) {
    const instText = installments
      .map((item) => {
        const parcela = String(item.installment_number ?? 1).padStart(3, '0');
        return `PARCELA ${parcela}: ${formatDateBR(item.due_date)} - ${formatMoneyBR(item.amount)}`;
      })
      .join(' | ');

    return `PAGAMENTO: ${paymentLines.join(' | ')}. DUPLICATAS: ${instText}`;
  }

  return `PAGAMENTO: ${paymentLines.join(' | ')}`;
}
