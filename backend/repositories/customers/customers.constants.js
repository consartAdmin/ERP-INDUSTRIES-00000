// ╔════════════════════════════════════════════════════════════════════╗
// ║ customers.constants.js — Tabelas, aliases e listas de campos       ║
// ╚════════════════════════════════════════════════════════════════════╝

export const TB = 'public."customers"';
export const TB_PLAIN = 'public.customers';
export const ALIAS = 'c';

// ✅ tabela IBGE por cliente
export const TB_IBGE = 'public."customersIbge"';

// ✅ tabela de segmentos (FK em customers.segment_id -> customerSegments.segment_id)
export const TB_SEG = 'public."customerSegments"';

// ✅ endereço de entrega vinculado por customers.customer_ad_id
export const TB_DELIVERY = 'public."customersAddressDelivery"';

// ✅ status / vendedor
export const TB_STATUS = 'public."customerStatus"';
export const TB_STATUS_TYPES = 'public."customerStatusTypes"';
export const TB_SELLER_FOR_CUSTOMER = 'public."SellerForCustomer"';
export const TB_SELLERS = 'public.sellers';

// Colunas aceitas pelo sortableTable. Os valores são expressões SQL fixas:
// nunca concatene diretamente o valor recebido pela query string.
export const CUSTOMER_ORDER_EXPRESSIONS = Object.freeze({
  customer_id: `${ALIAS}.customer_id`,
  trade_name: `LOWER(COALESCE(${ALIAS}.trade_name, ''))`,
  tax_id: `COALESCE(${ALIAS}.tax_id, '')`,
  email: `LOWER(COALESCE(${ALIAS}.email, ''))`,
  phone_number: `COALESCE(${ALIAS}.phone_number, '')`,
  postal_code: `COALESCE(${ALIAS}.postal_code, '')`,
  street_type: `LOWER(COALESCE(${ALIAS}.street_type, ''))`,
  street_name: `LOWER(COALESCE(${ALIAS}.street_name, ''))`,
  street_number: `LOWER(COALESCE(${ALIAS}.street_number, ''))`,
  address_complement: `LOWER(COALESCE(${ALIAS}.address_complement, ''))`,
  neighborhood: `LOWER(COALESCE(${ALIAS}.neighborhood, ''))`,
  city: `LOWER(COALESCE(${ALIAS}.city, ''))`,
  state: `UPPER(COALESCE(${ALIAS}.state, ''))`,
  seller_name: `LOWER(COALESCE(s.nickname, s.name, ''))`,
  segment_name: `LOWER(COALESCE(seg.segment_name, ''))`,
  status_name: `LOWER(COALESCE(cst.name_pt, cst.internal_code, ''))`,
  is_active: `${ALIAS}.is_active`,
});

// ---------------------------------------------------------------------
// Campos válidos para insert/update
// ---------------------------------------------------------------------
export const FIELDS = Object.freeze([
  'customer_type',
  'trade_name',
  'tax_id',
  'legal_name',
  'business_segment',
  'classification',
  'salesperson',
  'is_active',
  'email',
  'postal_code',
  'street_type',
  'street_name',
  'street_number',
  'address_complement',
  'neighborhood',
  'city',
  'state',
  'contact_name',
  'phone_number',
  'mobile_number',
  'financial_contact_name',
  'financial_contact_email',
  'financial_contact_phone',
  'financial_contact_mobile',
  'billing_email',
  'invoice_email',
  'financial_contact_notes',
  'default_chart_account_id',
  'default_cash_category_id',
  'default_cash_subcategory_id',
  'asaas_id',
  'state_registration',
  'municipal_registration',
  'segment_id',
]);

// Campos texto (trim → null quando vazio)
export const STRING_FIELDS = Object.freeze([
  'trade_name',
  'legal_name',
  'classification',
  'salesperson',
  'contact_name',
  'street_type',
  'street_name',
  'neighborhood',
  'city',
  'state',
  'business_segment',
  'email',
  'postal_code',
  'street_number',
  'address_complement',
  'phone_number',
  'mobile_number',
  'asaas_id',
  'state_registration',
  'municipal_registration',
  'financial_contact_name',
  'financial_contact_email',
  'financial_contact_phone',
  'financial_contact_mobile',
  'billing_email',
  'invoice_email',
  'financial_contact_notes',
]);

// ---------------------------------------------------------------------
// Endereço de entrega
// ---------------------------------------------------------------------
export const DELIVERY_FIELDS = Object.freeze([
  'customer_ad_street_type',
  'customer_ad_street_name',
  'customer_ad_street_number',
  'customer_ad_address_complement',
  'customer_ad_neighborhood',
  'customer_ad_city',
  'customer_ad_state',
  'customer_ad_active',
]);

// payload → coluna real em customersAddressDelivery
export const DELIVERY_COLUMN_MAP = Object.freeze({
  customer_ad_street_type: 'customer_ad_street_type',
  customer_ad_street_name: 'customer_ad_street_name',
  customer_ad_street_number: 'customer_ad_street_number',
  customer_ad_address_complement: 'customer_ad_address_complement',
  customer_ad_neighborhood: 'customer_ad_neighborhood',
  customer_ad_city: 'customer_ad_city',
  customer_ad_state: 'customer_ad_state',
  customer_ad_active: 'active',
});
