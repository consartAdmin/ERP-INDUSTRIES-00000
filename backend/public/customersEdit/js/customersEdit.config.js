// ╔══════════════════════════════════════════════════════════════════════╗
// ║ customersEdit.config.js — Configuração e rotas | PRODNEX ERP        ║
// ╚══════════════════════════════════════════════════════════════════════╝
'use strict';

export const API_BASE = window.apiBase || window.API_BASE || window.location.origin;

export const CUSTOMERS_EDIT_ROUTES = Object.freeze({
  customers: `${API_BASE}/api/customers`,
  customerById: (id) => `${API_BASE}/api/customers/${encodeURIComponent(id)}`,
  segments: `${API_BASE}/api/customer-segments`,
  classifications: `${API_BASE}/api/classificacoes`,
  sellers: `${API_BASE}/api/sellers`,
  sellerForCustomer: `${API_BASE}/api/seller-for-customer`,
  sellerForCustomerByCustomer: (id) =>
    `${API_BASE}/api/seller-for-customer/by-customer/${encodeURIComponent(id)}`,

  // Anexos do cliente (aba "Anexos")
  customerAttachments: (id) =>
    `${API_BASE}/api/customers/${encodeURIComponent(id)}/attachments`,
  customerAttachmentById: (id, attachmentId) =>
    `${API_BASE}/api/customers/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}`,
  customerAttachmentDownload: (id, attachmentId, { inline = false } = {}) =>
    `${API_BASE}/api/customers/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}/download${inline ? '?inline=1' : ''}`,
});

export const FINANCIAL_CONTACT_FIELDS = Object.freeze([
  'financial_contact_name',
  'financial_contact_email',
  'financial_contact_phone',
  'financial_contact_mobile',
  'billing_email',
  'invoice_email',
  'financial_contact_notes',
]);

export const DELIVERY_ADDRESS_FIELDS = Object.freeze([
  'customer_ad_id',
  'customer_ad_street_type',
  'customer_ad_street_name',
  'customer_ad_street_number',
  'customer_ad_address_complement',
  'customer_ad_neighborhood',
  'customer_ad_city',
  'customer_ad_state',
  'customer_ad_active',
]);
