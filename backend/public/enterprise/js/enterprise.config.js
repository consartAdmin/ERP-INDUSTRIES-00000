// ╔══════════════════════════════════════════════════════════════════════╗
// ║ enterprise.config.js                                                ║
// ║ Configurações e seletores do módulo Empresas                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

export const API_BASE =
  (typeof window !== 'undefined' && (window.API_BASE || window.apiBase)) ||
  window.location.origin;

export const ROUTES = Object.freeze({
  enterprises: `${API_BASE}/api/enterprises`,
  enterpriseById: (id) => `${API_BASE}/api/enterprises/${encodeURIComponent(id)}`,
  enterpriseLogo: (id) => `${API_BASE}/api/enterprises/${encodeURIComponent(id)}/logo`,
});

export const SELECTORS = Object.freeze({
  searchInput: '#searchInput',
  filterActive: '#filterActive',
  btnSearch: '#btnSearch',
  tableBody: '#enterpriseTableBody',
  resultInfo: '#enterpriseResultInfo',

  modal: '#enterpriseModal',
  modalTitle: '#enterpriseModalTitle',
  modalSubtitle: '#enterpriseModalSubtitle',
  form: '#enterpriseForm',
  btnSaveEnterprise: '#btnSaveEnterprise',

  enterpriseId: '#enterpriseId',
  corporate_name: '#corporate_name',
  trade_name: '#trade_name',
  cnpj: '#cnpj',
  state_registration: '#state_registration',
  municipal_registration: '#municipal_registration',
  tax_regime_code: '#tax_regime_code',
  status: '#status',
  opening_date: '#opening_date',
  cnae: '#cnae',
  zip_code: '#zip_code',
  address: '#address',
  address_number: '#address_number',
  address_complement: '#address_complement',
  district: '#district',
  city: '#city',
  state: '#state',
  city_ibge_code: '#city_ibge_code',
  phone: '#phone',
  whatsapp: '#whatsapp',
  email: '#email',
  website: '#website',
  nfe_environment: '#nfe_environment',
  nfe_series: '#nfe_series',
  next_nfe_number: '#next_nfe_number',
  logo_url: '#logo_url',
  enterpriseLogoFile: '#enterpriseLogoFile',
  btnSelectEnterpriseLogo: '#btnSelectEnterpriseLogo',
  btnRemoveEnterpriseLogo: '#btnRemoveEnterpriseLogo',
  enterpriseLogoStatus: '#enterpriseLogoStatus',
  enterpriseLogoPreviewBox: '#enterpriseLogoPreviewBox',
  enterpriseLogoPreview: '#enterpriseLogoPreview',
  slogan: '#slogan',
  document_notes: '#document_notes',
  is_active: '#is_active',
});

export const LIST_LIMIT = 100;
