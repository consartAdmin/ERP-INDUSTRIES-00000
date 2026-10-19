// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: customersList.config.js                                       ║
// ║ MODULE: Customers List — Configuration                              ║
// ║ PRODNEX ERP                                                         ║
// ║ API base, endpoints and immutable route definitions                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export const API_BASE =
  window.apiBase ||
  window.API_BASE ||
  window.location.origin;

export const ROUTES = Object.freeze({
  customers: `${API_BASE}/api/customers`,
  customerById: (id) =>
    `${API_BASE}/api/customers/${encodeURIComponent(id)}`,
  customersReportPdf: `${API_BASE}/api/customers/report/pdf`,
  customersReportExcel: `${API_BASE}/api/customers/report/excel`,
  exportPasswordStatus:
    `${API_BASE}/api/module-passwords/status?module=CUSTOMERS&action=EXPORT`,
  segmentos: `${API_BASE}/api/customer-segments?limit=100`,
  sellers: `${API_BASE}/api/sellers`,
  vendedores: `${API_BASE}/api/vendedores`,
  statusTypes: `${API_BASE}/api/customer-status-types`,
  sellerForCustomer: `${API_BASE}/api/seller-for-customer`,
  sellerForCustomerByCustomer: (customerId) =>
    `${API_BASE}/api/seller-for-customer/by-customer/${encodeURIComponent(customerId)}`,
});
