// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: customerRegistration.config.js                                ║
// ║ MODULE: Customer Registration — Configuration                       ║
// ║ PRODNEX ERP                                                         ║
// ║ API base and immutable endpoint definitions                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export const API_BASE =
  window.apiBase ||
  window.API_BASE ||
  window.location.origin;

export const ROUTES = Object.freeze({
  customersNew: `${API_BASE}/api/customers/new`,
  customersLegacy: `${API_BASE}/api/customers`,
  customerById: (id) =>
    `${API_BASE}/api/customers/${encodeURIComponent(id)}`,
  segmentos: `${API_BASE}/api/segmentos`,
  classificacoes: `${API_BASE}/api/classificacoes`,
  vendedores: `${API_BASE}/api/vendedores`,
  consultaCnpj: (cnpj) =>
    `${API_BASE}/api/public-cnpj/${encodeURIComponent(cnpj)}`,
  consultaCep: (cep) =>
    `https://viacep.com.br/ws/${encodeURIComponent(cep)}/json/`,
  ibgeUfs: `${API_BASE}/api/ibge-locations/ufs?status=true`,
  ibgeCities: (state) =>
    `${API_BASE}/api/ibge-locations/cities/${encodeURIComponent(state)}?status=true`,
});
