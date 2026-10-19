// ╔══════════════════════════════════════════════════════════════════════╗
// ║ accessProfiles.config.js                                            ║
// ║ Rotas e seletores do Cadastro de Perfis                             ║
// ╚══════════════════════════════════════════════════════════════════════╝

export const API_BASE =
  (typeof window !== 'undefined' && (window.API_BASE || window.apiBase)) ||
  window.location.origin;

export const ROUTES = Object.freeze({
  profiles: `${API_BASE}/api/access-profiles`,
  profileById: (id) => `${API_BASE}/api/access-profiles/${encodeURIComponent(id)}`,
});

export const SELECTORS = Object.freeze({
  searchInput: '#apfSearchInput',
  filterActive: '#apfFilterActive',
  btnSearch: '#apfBtnSearch',
  btnNew: '#apfBtnNew',
  tableBody: '#apfTableBody',
  tableInfo: '#apfTableInfo',

  modal: '#accessProfileModal',
  modalTitle: '#apfModalTitle',
  modalSubtitle: '#apfModalSubtitle',
  form: '#apfForm',
  id: '#apfId',
  name: '#apfName',
  code: '#apfCode',
  sortOrder: '#apfSortOrder',
  description: '#apfDescription',
  isActive: '#apfIsActive',
  note: '#apfFormNote',
  btnSave: '#apfBtnSave',
});

export const PERMISSION_KEYS = Object.freeze([
  'can_view',
  'can_create',
  'can_edit',
  'can_delete',
  'can_export',
]);

export const NO_ACCESS_CODE = 'SEM_ACESSO';
