// ╔════════════════════════════════════════════════════════════════════╗
// ║ customers.mappers.js — Linha do banco → objeto da API              ║
// ╚════════════════════════════════════════════════════════════════════╝

import { normalizeCustomerType } from './customers.utils.js';

// ---------------------------------------------------------------------
// Normaliza linha completa
// ---------------------------------------------------------------------
export const mapRow = (r) => {
  const segment_id = r.segment_id ?? null;
  const segment_name = r.segment_name ?? null;

  return {
    customer_id: r.customer_id,
    customer_type: normalizeCustomerType(r.customer_type),
    trade_name: r.trade_name ?? null,
    tax_id: r.tax_id ?? null,
    legal_name: r.legal_name ?? null,
    business_segment: r.business_segment ?? null,
    classification: r.classification ?? null,
    salesperson: r.salesperson ?? null,
    is_active: r.is_active ?? true,
    email: r.email ?? null,
    postal_code: r.postal_code ?? null,
    street_type: r.street_type ?? null,
    street_name: r.street_name ?? null,
    street_number: r.street_number ?? null,
    address_complement: r.address_complement ?? null,
    neighborhood: r.neighborhood ?? null,
    city: r.city ?? null,
    state: r.state ?? null,
    contact_name: r.contact_name ?? null,
    phone_number: r.phone_number ?? null,
    mobile_number: r.mobile_number ?? null,
    financial_contact_name: r.financial_contact_name ?? null,
    financial_contact_email: r.financial_contact_email ?? null,
    financial_contact_phone: r.financial_contact_phone ?? null,
    financial_contact_mobile: r.financial_contact_mobile ?? null,
    billing_email: r.billing_email ?? null,
    invoice_email: r.invoice_email ?? null,
    financial_contact_notes: r.financial_contact_notes ?? null,
    default_chart_account_id: r.default_chart_account_id ?? null,
    default_cash_category_id: r.default_cash_category_id ?? null,
    default_cash_subcategory_id: r.default_cash_subcategory_id ?? null,
    asaas_id: r.asaas_id ?? null,
    state_registration: r.state_registration ?? null,
    municipal_registration: r.municipal_registration ?? null,
    created_at: r.created_at ?? null,
    updated_at: r.updated_at ?? null,

    // ENDEREÇO DE ENTREGA
    customer_ad_id: r.customer_ad_id ?? null,
    customer_ad_street_type: r.customer_ad_street_type ?? null,
    customer_ad_street_name: r.customer_ad_street_name ?? null,
    customer_ad_street_number: r.customer_ad_street_number ?? null,
    customer_ad_address_complement: r.customer_ad_address_complement ?? null,
    customer_ad_neighborhood: r.customer_ad_neighborhood ?? null,
    customer_ad_city: r.customer_ad_city ?? null,
    customer_ad_state: r.customer_ad_state ?? null,
    customer_ad_active:
      r.customer_ad_id == null ? null : (r.customer_ad_active ?? true),

    // ✅ SEGMENTO
    segment_id,
    segment_code: r.segment_code ?? null,
    segment_name,
    segment_label:
      segment_name && segment_id
        ? `${segment_name} (${segment_id})`
        : (segment_name ?? null),

    // 🔹 STATUS
    status_type_id: r.status_type_id ?? null,
    status_name_pt: r.status_name_pt ?? null,
    status_internal_code: r.status_internal_code ?? null,
    status_color_hex: r.status_color_hex ?? null,
    status_label: r.status_label ?? null,

    // ✅ VENDEDOR
    seller_id: r.seller_id ?? null,
    seller_name: r.seller_name ?? null,

    // ✅ IBGE
    ibge_city_code: r.ibge_city_code ?? null,
    ibge_source: r.ibge_source ?? null,
    ibge_confidence: r.ibge_confidence ?? null,
  };
};

// ---------------------------------------------------------------------
// Projeção leve para /search (autocomplete)
// ---------------------------------------------------------------------
export const mapSearchRow = (r) => ({
  customer_id: r.customer_id,
  customer_type: normalizeCustomerType(r.customer_type),
  trade_name: r.trade_name ?? null,
  legal_name: r.legal_name ?? null,
  tax_id: r.tax_id ?? null,
  city: r.city ?? null,
  state: r.state ?? null,
  email: r.email ?? null,
  phone_number: r.phone_number ?? null,
  mobile_number: r.mobile_number ?? null,

  // ✅ segmento (leve)
  segment_id: r.segment_id ?? null,
  segment_name: r.segment_name ?? null,
  segment_label:
    (r.segment_name && r.segment_id)
      ? `${r.segment_name} (${r.segment_id})`
      : (r.segment_name ?? null),

  // ✅ status (leve)
  status_type_id: r.status_type_id ?? null,
  status_label: r.status_label ?? null,
});
