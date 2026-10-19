export const API_BASE = '/api/module-system';

export const MENU_TYPE_LABELS = Object.freeze({
  dropdown: '🗂️ Dropdown',
  submenu: '📂 Submenu',
  link: '🔗 Link',
});

export const elements = Object.freeze({
  moduleForm: document.getElementById('moduleForm'),
  moduleId: document.getElementById('moduleId'),
  name: document.getElementById('name'),
  path: document.getElementById('path'),
  menuType: document.getElementById('menuType'),
  parentId: document.getElementById('parentId'),
  sortOrder: document.getElementById('sortOrder'),
  htmlId: document.getElementById('htmlId'),
  cssClass: document.getElementById('cssClass'),
  feature: document.getElementById('feature'),
  isActive: document.getElementById('isActive'),
  isExternal: document.getElementById('isExternal'),
  isPublic: document.getElementById('isPublic'),
  btnSave: document.getElementById('btnSave'),
  btnClear: document.getElementById('btnClear'),
  formTitle: document.getElementById('ms-form-title'),
  searchInput: document.getElementById('searchInput'),
  filterStatus: document.getElementById('filterStatus'),
  filterType: document.getElementById('filterType'),
  filterParent: document.getElementById('filterParent'),
  filterVisibility: document.getElementById('filterVisibility'),
  btnClearFilters: document.getElementById('btnClearFilters'),
  tbody: document.getElementById('modulesTableBody'),
  tableInfo: document.getElementById('apTableInfo'),
  pageInfo: document.getElementById('apPageInfo'),
  btnPreviousPage: document.getElementById('btnPreviousPage'),
  btnNextPage: document.getElementById('btnNextPage'),
  rowsPerPage: document.getElementById('apRowsPerPage'),
});
