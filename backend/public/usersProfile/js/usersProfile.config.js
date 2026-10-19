// ╔══════════════════════════════════════════════════════════════════════╗
// ║ usersProfile.config.js                                              ║
// ║ Rotas e seletores do módulo Perfis de Usuários                      ║
// ╚══════════════════════════════════════════════════════════════════════╝

export const API_BASE =
  (typeof window !== 'undefined' && (window.API_BASE || window.apiBase)) ||
  window.location.origin;

export const ROUTES = Object.freeze({
  users: `${API_BASE}/api/users`,
  profiles: `${API_BASE}/api/users-profile/profiles`,
  summary: `${API_BASE}/api/users-profile/summary`,
  userProfiles: (userId) => `${API_BASE}/api/users-profile/${encodeURIComponent(userId)}`,
});

export const SELECTORS = Object.freeze({
  searchInput: '#upSearchInput',
  filterActive: '#upFilterActive',
  btnSearch: '#upBtnSearch',
  usersTableBody: '#upUsersTableBody',
  tableInfo: '#upTableInfo',

  modal: '#usersProfileModal',
  modalTitle: '#upModalTitle',
  modalSubtitle: '#upModalSubtitle',
  modalInfo: '#upModalInfo',
  form: '#upProfilesForm',
  moduleSearch: '#upModuleSearch',
  bulkProfile: '#upBulkProfile',
  btnApplyBulk: '#upBtnApplyBulk',
  legend: '#upProfileLegend',
  modulesTableBody: '#upModulesTableBody',
  btnSave: '#upBtnSaveProfiles',
});

export const USERS_LIMIT = 200;

export const PERMISSION_KEYS = Object.freeze([
  'can_view',
  'can_create',
  'can_edit',
  'can_delete',
  'can_export',
]);

export const CUSTOM_PROFILE = 'PERSONALIZADO';
